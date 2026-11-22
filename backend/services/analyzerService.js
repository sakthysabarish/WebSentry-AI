const { chromium } = require("playwright");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { validateTargetUrl } = require("../utils/urlValidator");
const { runAccessibilityAudit } = require("./accessibilityService");

// Ensure public screenshots directory exists
const SCREENSHOTS_DIR = path.join(__dirname, "../public/screenshots");
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Safely checks a single URL status with a quick HEAD/GET request.
 * Runs SSRF validation first to avoid probing internal infrastructure.
 * Retries with GET if HEAD returns 405 Method Not Allowed.
 * @param {string} url
 * @param {string} type - "internal" | "external"
 * @param {number} timeoutMs
 * @returns {Promise<{ isBroken: boolean, url: string, type: string, statusCode: number|null, error: string|null }>}
 */
async function checkLinkStatus(url, type = "internal", timeoutMs = 4500) {
    try {
        const validation = await validateTargetUrl(url);
        if (!validation.isValid) {
            return {
                isBroken: true,
                url,
                type,
                statusCode: null,
                error: `Blocked by security: ${validation.error}`
            };
        }

        const parsed = new URL(url);
        const client = parsed.protocol === "https:" ? https : http;

        return new Promise((resolve) => {
            const req = client.request(
                parsed,
                {
                    method: "HEAD",
                    timeout: timeoutMs,
                    headers: {
                        "User-Agent": "AI-Web-Application-Analyzer/1.0 (Link Verifier; +https://example.com/bot)"
                    }
                },
                (res) => {
                    // If server does not allow HEAD (405 Method Not Allowed), retry with GET
                    if (res.statusCode === 405) {
                        const getReq = client.request(
                            parsed,
                            {
                                method: "GET",
                                timeout: timeoutMs,
                                headers: {
                                    "User-Agent": "AI-Web-Application-Analyzer/1.0 (Link Verifier; +https://example.com/bot)"
                                }
                            },
                            (getRes) => {
                                const isBroken = getRes.statusCode >= 400;
                                getRes.destroy(); // Don't download entire body
                                resolve({
                                    isBroken,
                                    url,
                                    type,
                                    statusCode: getRes.statusCode,
                                    error: isBroken ? `HTTP ${getRes.statusCode}` : null
                                });
                            }
                        );
                        getReq.on("error", (err) => resolve({ isBroken: true, url, type, statusCode: null, error: err.message }));
                        getReq.on("timeout", () => { getReq.destroy(); resolve({ isBroken: true, url, type, statusCode: null, error: "Request timed out" }); });
                        getReq.end();
                        return;
                    }

                    const isBroken = res.statusCode >= 400;
                    resolve({
                        isBroken,
                        url,
                        type,
                        statusCode: res.statusCode,
                        error: isBroken ? `HTTP ${res.statusCode}` : null
                    });
                }
            );

            req.on("timeout", () => {
                req.destroy();
                resolve({ isBroken: true, url, type, statusCode: null, error: "Request timed out" });
            });

            req.on("error", (err) => {
                resolve({ isBroken: true, url, type, statusCode: null, error: err.message });
            });

            req.end();
        });
    } catch (e) {
        return { isBroken: true, url, type, statusCode: null, error: e.message };
    }
}

/**
 * Comprehensive Playwright Website Scanner.
 * @param {string} targetUrl - Registered website URL to analyze
 * @param {number|string} projectId - Associated project ID for tagging assets
 * @returns {Promise<Object>} Structured analysis data
 */
async function analyzeWebsite(targetUrl, projectId = null) {
    // 1. Initial SSRF & URL Security Validation
    const validation = await validateTargetUrl(targetUrl);
    if (!validation.isValid) {
        const error = new Error(validation.error);
        error.isSecurityBlock = true;
        throw error;
    }

    const cleanUrl = validation.sanitizedUrl;
    let browser = null;
    let context = null;

    try {
        // 2. Launch headless Chromium
        browser = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions"
            ]
        });

        // 3. Isolated browser context with desktop viewport
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 AI-Web-Analyzer/1.0",
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true
        });

        // 4. In-flight Request Route Interception (Prevents redirects and subresource SSRF)
        await context.route("**/*", async (route) => {
            const reqUrl = route.request().url();
            // Allow inline data: and blob: sources
            if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
                return route.continue();
            }

            try {
                const check = await validateTargetUrl(reqUrl);
                if (!check.isValid) {
                    console.warn(`[SSRF Blocked] In-flight request aborted: ${reqUrl}`);
                    return route.abort("blockedbyclient");
                }
                route.continue();
            } catch {
                route.abort("blockedbyclient");
            }
        });

        const page = await context.newPage();

        // 5. Setup Listeners for Console Errors and Network Failures
        const consoleErrors = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push({
                    type: "console.error",
                    text: msg.text().slice(0, 300),
                    location: msg.location()?.url ? `${msg.location().url}:${msg.location().lineNumber}` : null
                });
            }
        });

        page.on("pageerror", (err) => {
            consoleErrors.push({
                type: "uncaught.exception",
                text: err.message.slice(0, 300),
                location: err.stack ? err.stack.split("\n")[1]?.trim() : null
            });
        });

        const failedRequests = [];
        page.on("requestfailed", (request) => {
            const failureText = request.failure()?.errorText || "Failed";
            // Ignore requests explicitly cancelled by client navigation/abort
            if (!failureText.includes("net::ERR_ABORTED")) {
                failedRequests.push({
                    url: request.url().slice(0, 300),
                    resourceType: request.resourceType(),
                    failureText: failureText
                });
            }
        });

        // 6. Inject Web Vitals & Performance Observer before page scripts execute
        await page.addInitScript(() => {
            window.__perfMetrics = {
                fcp: null,
                lcp: null,
                cls: 0,
                clsSupported: false,
                hasClsEntry: false,
                tbt: 0,
                longTaskSupported: false,
                longTasksCount: 0,
                longTasksTotalDuration: 0
            };

            // First Contentful Paint
            try {
                new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (entry.name === "first-contentful-paint") {
                            window.__perfMetrics.fcp = Math.round(entry.startTime);
                        }
                    }
                }).observe({ type: "paint", buffered: true });
            } catch {}

            // Largest Contentful Paint
            try {
                new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        window.__perfMetrics.lcp = Math.round(entries[entries.length - 1].startTime);
                    }
                }).observe({ type: "largest-contentful-paint", buffered: true });
            } catch {}

            // Cumulative Layout Shift
            try {
                new PerformanceObserver((entryList) => {
                    window.__perfMetrics.clsSupported = true;
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            window.__perfMetrics.cls = parseFloat((window.__perfMetrics.cls + entry.value).toFixed(4));
                            window.__perfMetrics.hasClsEntry = true;
                        }
                    }
                }).observe({ type: "layout-shift", buffered: true });
            } catch {}

            // Long Tasks (for Total Blocking Time)
            try {
                new PerformanceObserver((entryList) => {
                    window.__perfMetrics.longTaskSupported = true;
                    for (const entry of entryList.getEntries()) {
                        window.__perfMetrics.longTasksCount++;
                        window.__perfMetrics.longTasksTotalDuration += Math.round(entry.duration);
                        if (entry.duration > 50) {
                            window.__perfMetrics.tbt += Math.round(entry.duration - 50);
                        }
                    }
                }).observe({ type: "longtask", buffered: true });
            } catch {}
        });

        // 7. Navigate to URL & Measure Load Time
        const startTime = Date.now();
        let mainResponse = null;

        try {
            mainResponse = await page.goto(cleanUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000 // 30s timeout
            });
        } catch (navErr) {
            const err = new Error(`Failed to navigate to ${cleanUrl}: ${navErr.message}`);
            err.isNavigationError = true;
            throw err;
        }

        const pageLoadingTimeMs = Date.now() - startTime;
        const httpStatus = mainResponse ? mainResponse.status() : null;
        const finalUrl = page.url();

        // Allow dynamic DOM rendering and animations a moment to stabilize
        try {
            await page.waitForTimeout(1500);
        } catch {}

        // 8. Capture Screenshots (Desktop Viewport and Full Page)
        const timestamp = Date.now();
        const randomToken = Math.random().toString(36).substring(2, 8);
        const prefix = projectId ? `proj-${projectId}` : `scan-${timestamp}`;
        const desktopFilename = `${prefix}-desktop-${timestamp}-${randomToken}.png`;
        const fullFilename = `${prefix}-full-${timestamp}-${randomToken}.png`;

        const desktopFilePath = path.join(SCREENSHOTS_DIR, desktopFilename);
        const fullFilePath = path.join(SCREENSHOTS_DIR, fullFilename);

        let screenshotStatus = { desktop: null, fullPage: null };

        try {
            await page.screenshot({ path: desktopFilePath, fullPage: false });
            screenshotStatus.desktop = {
                url: `/screenshots/${desktopFilename}`,
                filename: desktopFilename,
                width: 1280,
                height: 800
            };
        } catch (e) {
            console.error("Desktop screenshot failed:", e.message);
        }

        try {
            await page.screenshot({ path: fullFilePath, fullPage: true });
            screenshotStatus.fullPage = {
                url: `/screenshots/${fullFilename}`,
                filename: fullFilename
            };
        } catch (e) {
            console.error("Fullpage screenshot failed:", e.message);
        }

        // 9. Extract DOM, Headings, UI Styles, Metadata, Images, and Links
        const domAnalysis = await page.evaluate(() => {
            // Title & Metadata
            const title = document.title ? document.title.trim() : null;
            const metaDescTag = document.querySelector('meta[name="description" i]') ||
                                document.querySelector('meta[property="og:description" i]');
            const metaDescription = metaDescTag ? (metaDescTag.getAttribute("content") || "").trim() : null;
            const viewportMeta = document.querySelector('meta[name="viewport" i]')?.getAttribute("content") || null;
            const canonicalUrl = document.querySelector('link[rel="canonical" i]')?.getAttribute("href") || null;
            const charset = document.characterSet || document.charset || null;

            // Comprehensive Headings Extraction (H1 to H6 + role="heading")
            const headingLevels = ["h1", "h2", "h3", "h4", "h5", "h6"];
            const headingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
            const headingTexts = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
            const allHeadings = [];

            const headingElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading']"));

            headingElements.forEach((el) => {
                let tag = el.tagName.toLowerCase();
                if (!headingLevels.includes(tag)) {
                    const ariaLevel = el.getAttribute("aria-level");
                    if (ariaLevel && headingLevels.includes(`h${ariaLevel}`)) {
                        tag = `h${ariaLevel}`;
                    } else {
                        tag = "h2"; // default fallback for aria role="heading"
                    }
                }

                const text = el.textContent ? el.textContent.trim().replace(/\s+/g, " ") : "";
                if (text) {
                    headingCounts[tag]++;
                    headingTexts[tag].push(text);
                    allHeadings.push({
                        tag: tag.toUpperCase(),
                        level: parseInt(tag.replace("h", ""), 10),
                        text: text.slice(0, 300)
                    });
                }
            });

            const headings = {
                totalHeadings: allHeadings.length,
                counts: headingCounts,
                h1Count: headingCounts.h1,
                h2Count: headingCounts.h2,
                h3Count: headingCounts.h3,
                h4Count: headingCounts.h4,
                h5Count: headingCounts.h5,
                h6Count: headingCounts.h6,
                h1Headings: headingTexts.h1,
                h2Headings: headingTexts.h2,
                h3Headings: headingTexts.h3,
                h4Headings: headingTexts.h4,
                h5Headings: headingTexts.h5,
                h6Headings: headingTexts.h6,
                items: allHeadings
            };

            // Images
            const allImages = Array.from(document.querySelectorAll("img"));
            const missingAltImages = [];
            const brokenImages = [];

            allImages.forEach((img) => {
                const src = img.src || img.getAttribute("src") || "";
                const alt = img.getAttribute("alt");
                const hasValidAlt = alt !== null && alt.trim().length > 0;

                if (!hasValidAlt) {
                    missingAltImages.push({ src: src.slice(0, 200), altText: alt });
                }

                if (img.complete && img.naturalWidth === 0 && src) {
                    brokenImages.push({ src: src.slice(0, 200) });
                }
            });

            // Links
            const allLinks = Array.from(document.querySelectorAll("a[href]")).map((a) => {
                try {
                    const resolved = new URL(a.getAttribute("href"), document.baseURI);
                    return {
                        href: resolved.href,
                        protocol: resolved.protocol,
                        hostname: resolved.hostname,
                        text: a.textContent.trim().slice(0, 80)
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // UI & Styling Analysis
            const bodyStyle = window.getComputedStyle(document.body);
            const h1El = document.querySelector("h1");
            const h2El = document.querySelector("h2");
            const h1Style = h1El ? window.getComputedStyle(h1El) : null;
            const h2Style = h2El ? window.getComputedStyle(h2El) : null;

            // Sample Buttons
            const buttonElements = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a.btn, a.button')).slice(0, 6);
            const buttonStyles = buttonElements.map(btn => {
                const s = window.getComputedStyle(btn);
                return {
                    text: btn.textContent?.trim().slice(0, 40) || btn.getAttribute("value") || "Button",
                    backgroundColor: s.backgroundColor,
                    color: s.color,
                    borderRadius: s.borderRadius,
                    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
                    fontSize: s.fontSize,
                    fontWeight: s.fontWeight
                };
            });

            // Color Palette Sampling (sample up to 5 background colors and 5 text colors)
            const sampleElements = Array.from(document.querySelectorAll("body, header, nav, main, section, footer, div, p, h1, h2")).slice(0, 30);
            const bgSet = new Set();
            const textSet = new Set();
            sampleElements.forEach(el => {
                const s = window.getComputedStyle(el);
                if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") {
                    bgSet.add(s.backgroundColor);
                }
                if (s.color) {
                    textSet.add(s.color);
                }
            });

            // Viewport & Overflow
            const scrollWidth = document.documentElement.scrollWidth;
            const clientWidth = document.documentElement.clientWidth;
            const hasHorizontalOverflow = scrollWidth > clientWidth;

            return {
                title,
                metaDescription,
                viewportMeta,
                canonicalUrl,
                charset,
                headings,
                images: {
                    total: allImages.length,
                    broken: brokenImages,
                    missingAlt: missingAltImages,
                    validCount: Math.max(0, allImages.length - brokenImages.length - missingAltImages.length)
                },
                links: allLinks,
                ui: {
                    typography: {
                        bodyFontFamily: bodyStyle.fontFamily,
                        bodyFontSize: bodyStyle.fontSize,
                        bodyFontWeight: bodyStyle.fontWeight,
                        bodyLineHeight: bodyStyle.lineHeight,
                        heading1Font: h1Style ? `${h1Style.fontSize} ${h1Style.fontFamily}` : null,
                        heading2Font: h2Style ? `${h2Style.fontSize} ${h2Style.fontFamily}` : null
                    },
                    colors: {
                        bodyBackground: bodyStyle.backgroundColor,
                        bodyTextColor: bodyStyle.color,
                        sampleBackgroundColors: Array.from(bgSet).slice(0, 6),
                        sampleTextColors: Array.from(textSet).slice(0, 6)
                    },
                    buttons: {
                        totalButtonsFound: buttonElements.length,
                        sampleButtonStyles: buttonStyles
                    },
                    layout: {
                        viewportDimensions: { width: window.innerWidth, height: window.innerHeight },
                        scrollDimensions: { scrollWidth, scrollHeight: document.documentElement.scrollHeight },
                        hasHorizontalOverflow,
                        viewportMeta: viewportMeta,
                        hasResponsiveViewport: Boolean(viewportMeta && viewportMeta.includes("width=device-width"))
                    }
                }
            };
        });

        // 10. Extract Performance & Web Vitals Data
        const performanceData = await page.evaluate(() => {
            const perf = window.__perfMetrics || {};

            // Fallback for FCP if observer didn't trigger
            if (perf.fcp === null) {
                const paintEntries = performance.getEntriesByType("paint");
                const fcpEntry = paintEntries.find(e => e.name === "first-contentful-paint");
                if (fcpEntry) {
                    perf.fcp = Math.round(fcpEntry.startTime);
                }
            }

            // Fallback for LCP if observer didn't trigger
            if (perf.lcp === null) {
                const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
                if (lcpEntries && lcpEntries.length > 0) {
                    perf.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
                }
            }

            const navEntries = performance.getEntriesByType("navigation");
            const nav = navEntries.length > 0 ? navEntries[0] : null;

            return {
                firstContentfulPaintMs: perf.fcp !== null ? perf.fcp : null,
                largestContentfulPaintMs: perf.lcp !== null ? perf.lcp : null,
                cumulativeLayoutShift: perf.clsSupported || perf.hasClsEntry ? perf.cls : 0,
                totalBlockingTimeMs: perf.longTaskSupported ? perf.tbt : 0,
                metricsStatus: {
                    fcp: perf.fcp !== null ? "measured" : "unavailable",
                    lcp: perf.lcp !== null ? "measured" : "unavailable",
                    cls: perf.clsSupported || perf.hasClsEntry ? "measured" : "unavailable",
                    tbt: perf.longTaskSupported ? "measured" : "unavailable"
                },
                longTasks: {
                    count: perf.longTasksCount || 0,
                    totalDurationMs: perf.longTasksTotalDuration || 0
                },
                networkTimings: nav ? {
                    dnsLookupMs: Math.max(0, Math.round(nav.domainLookupEnd - nav.domainLookupStart)),
                    tcpHandshakeMs: Math.max(0, Math.round(nav.connectEnd - nav.connectStart)),
                    ttfbMs: Math.max(0, Math.round(nav.responseStart - nav.requestStart)),
                    domInteractiveMs: Math.max(0, Math.round(nav.domInteractive)),
                    domContentLoadedMs: Math.max(0, Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart)),
                    domCompleteMs: Math.max(0, Math.round(nav.domComplete))
                } : null
            };
        });

        // 11. Categorize Links and Check Sample for Broken Status
        const targetHost = new URL(cleanUrl).hostname.toLowerCase();
        const uniqueInternalLinks = new Set();
        const uniqueExternalLinks = new Set();

        domAnalysis.links.forEach((link) => {
            if (link.protocol === "http:" || link.protocol === "https:") {
                const linkHost = link.hostname.toLowerCase();
                if (linkHost === targetHost || linkHost.endsWith("." + targetHost)) {
                    uniqueInternalLinks.add(link.href);
                } else {
                    uniqueExternalLinks.add(link.href);
                }
            }
        });

        // Sample up to 10 internal and 6 external links for status verification
        const sampleInternal = Array.from(uniqueInternalLinks).slice(0, 10);
        const sampleExternal = Array.from(uniqueExternalLinks).slice(0, 6);

        const brokenInternalLinks = [];
        const brokenExternalLinks = [];

        await Promise.all(
            sampleInternal.map(async (linkUrl) => {
                const res = await checkLinkStatus(linkUrl, "internal");
                if (res.isBroken) {
                    brokenInternalLinks.push(res);
                }
            })
        );

        await Promise.all(
            sampleExternal.map(async (linkUrl) => {
                const res = await checkLinkStatus(linkUrl, "external");
                if (res.isBroken) {
                    brokenExternalLinks.push(res);
                }
            })
        );

        const allBrokenLinks = [...brokenInternalLinks, ...brokenExternalLinks];

        // 12. Run Accessibility Audit using axe-core (inside existing browser session)
        let accessibility = null;
        try {
            accessibility = await runAccessibilityAudit(page);
        } catch (a11yErr) {
            console.error("Accessibility audit error:", a11yErr.message);
            accessibility = {
                score: null,
                scoringMethod: "Weighted deduction per affected element: Critical (-5), Serious (-3), Moderate (-1.5), Minor (-0.5). Automated estimate, not official WCAG certification.",
                error: a11yErr.message,
                totalViolations: 0,
                critical: 0,
                serious: 0,
                moderate: 0,
                minor: 0,
                totalAffectedElements: 0,
                passesCount: 0,
                incompleteCount: 0,
                violations: []
            };
        }

        // 13. Structure and Return Final Result
        return {
            status: "completed",
            pageTitle: domAnalysis.title,
            hasPageTitle: Boolean(domAnalysis.title && domAnalysis.title.length > 0),
            websiteUrl: cleanUrl,
            finalUrl: finalUrl,
            httpStatus: httpStatus,
            pageLoadingTimeMs: pageLoadingTimeMs,
            totalLinks: domAnalysis.links.length,
            checkedLinksCount: sampleInternal.length + sampleExternal.length,
            brokenLinksCount: allBrokenLinks.length,
            brokenLinks: allBrokenLinks,
            linksSummary: {
                totalLinksOnPage: domAnalysis.links.length,
                uniqueInternalLinksCount: uniqueInternalLinks.size,
                uniqueExternalLinksCount: uniqueExternalLinks.size,
                checkedCount: sampleInternal.length + sampleExternal.length,
                brokenInternalCount: brokenInternalLinks.length,
                brokenExternalCount: brokenExternalLinks.length,
                brokenInternalLinks: brokenInternalLinks,
                brokenExternalLinks: brokenExternalLinks
            },
            totalImages: domAnalysis.images.total,
            validImages: domAnalysis.images.validCount,
            brokenImages: domAnalysis.images.broken,
            missingAltImages: domAnalysis.images.missingAlt,
            consoleErrors: consoleErrors,
            failedRequests: failedRequests,
            screenshots: screenshotStatus,
            performance: {
                pageLoadingTimeMs,
                ...performanceData
            },
            accessibility: accessibility,
            uiAnalysis: domAnalysis.ui,
            headings: domAnalysis.headings,
            metadata: {
                description: domAnalysis.metaDescription,
                hasDescription: Boolean(domAnalysis.metaDescription),
                viewport: domAnalysis.viewportMeta,
                canonical: domAnalysis.canonicalUrl,
                charset: domAnalysis.charset
            },
            scannedAt: new Date().toISOString()
        };

    } finally {
        // Guaranteed cleanup of browser resources
        if (context) {
            try { await context.close(); } catch {}
        }
        if (browser) {
            try { await browser.close(); } catch {}
        }
    }
}

module.exports = {
    analyzeWebsite
};
