/**
 * AI-Powered Accessibility Recommendation Service
 * 
 * Generates actionable, contextual accessibility explanations and code remediations
 * based on actual axe-core audit violations.
 * 
 * Rules:
 * - Does not invent issues or modify external websites.
 * - Accurately distinguishes official WCAG failures (Level A / AA) from axe-core best-practice advisories.
 * - Provides realistic, clean HTML code before/after snippets tailored to the inspected elements.
 */

/**
 * Maps axe-core impact to user-facing priority string.
 */
function mapPriority(impact) {
    switch ((impact || "").toLowerCase()) {
        case "critical":
            return "High";
        case "serious":
            return "High";
        case "moderate":
            return "Medium";
        case "minor":
            return "Low";
        default:
            return "Medium";
    }
}

/**
 * Determines whether a violation is an official WCAG normative criterion failure or an advisory best-practice.
 */
function classifyWcagStatus(tags) {
    const wcagTags = (tags || []).filter(t => t.startsWith("wcag"));
    if (wcagTags.length > 0) {
        const primaryTag = wcagTags[0].toUpperCase();
        return {
            isWcagFailure: true,
            criteria: `${primaryTag} (Normative Criterion Failure)`
        };
    }
    return {
        isWcagFailure: false,
        criteria: "Best Practice Advisory (Supports WCAG 1.3.1 Info and Relationships & 2.4.1 Bypass Blocks)"
    };
}

/**
 * Knowledge base of contextual remediation generators for specific axe-core rule IDs.
 */
const ruleKnowledgeBase = {
    "landmark-one-main": {
        title: "Missing Main Landmark",
        explanation: "The document does not contain an HTML5 <main> landmark element.",
        whyItMatters: "Screen reader users navigate via landmark shortcuts (e.g. the 'M' or 'D' key in NVDA and JAWS). Without a <main> landmark, users cannot bypass navigation menus or repetitive headers to jump straight to the page's primary content.",
        solution: "Wrap the primary, unique content of the page inside an HTML5 <main> element. Ensure it is placed directly within the <body> and is not nested inside another landmark.",
        generateCodeExample: (sampleHtml, pageTitle) => {
            const heading = pageTitle || "Page Heading";
            const snippet = sampleHtml && sampleHtml.length < 150 ? sampleHtml : `<p>Primary content goes here...</p>`;
            return `<!-- Before: Content uncontained without a main landmark -->\n<body>\n  ${snippet}\n</body>\n\n<!-- Corrected: Wrapped in semantic <main> -->\n<body>\n  <main>\n    <h1>${heading}</h1>\n    ${snippet}\n  </main>\n</body>`;
        },
        expectedImprovement: "Enables instant 1-keystroke navigation to core content for assistive tech users and satisfies modern accessibility linters."
    },

    "page-has-heading-one": {
        title: "Missing H1 Heading",
        explanation: "The page does not contain a level-one heading (<h1>).",
        whyItMatters: "The <h1> element communicates the overarching topic of the webpage. Screen readers use headings to generate a structured outline of the page. Without an <h1>, screen reader users cannot quickly verify what page they are on, and document hierarchy is weakened for search engine indexing.",
        solution: "Add a clear, descriptive <h1> heading at the start of the primary <main> content area that concisely summarizes the page's topic.",
        generateCodeExample: (sampleHtml, pageTitle) => {
            const titleText = pageTitle || "Example Domain";
            return `<!-- Before: Missing primary level-one heading -->\n<main>\n  <p>This domain is for use in documentation examples...</p>\n</main>\n\n<!-- Corrected: Meaningful <h1> added to establish document topic -->\n<main>\n  <h1>${titleText}</h1>\n  <p>This domain is for use in documentation examples...</p>\n</main>`;
        },
        expectedImprovement: "Users navigating by headings (shortcut '1' or 'H') can immediately identify the page's purpose and follow a logical reading flow."
    },

    "region": {
        title: "Content Outside Landmarks",
        explanation: "One or more content elements reside directly in the document body without being enclosed in appropriate landmark regions.",
        whyItMatters: "Landmark navigation is only comprehensive if all perceptible page content belongs to a recognized landmark. Content left floating outside landmarks becomes 'orphan' text that can easily be missed by keyboard and screen reader users navigating by landmark blocks.",
        solution: "Group all top-level content into semantic HTML5 landmark containers (<header>, <nav>, <main>, <aside>, <footer>). Avoid excessive nesting (e.g., do not nest <main> inside <main>).",
        generateCodeExample: (sampleHtml, pageTitle) => {
            const titleText = pageTitle || "Example Domain";
            return `<!-- Before: Multiple elements uncontained outside landmarks -->\n<body>\n  <p>This domain is for use in documentation examples...</p>\n  <a href="https://example.com">More information...</a>\n</body>\n\n<!-- Corrected: Clean landmark distribution without redundant nesting -->\n<body>\n  <main>\n    <h1>${titleText}</h1>\n    <p>This domain is for use in documentation examples...</p>\n    <p><a href="https://example.com">More information...</a></p>\n  </main>\n  <footer>\n    <p>&copy; IANA / ICANN. All rights reserved.</p>\n  </footer>\n</body>`;
        },
        expectedImprovement: "Eliminates orphan content and ensures 100% of body elements are reachable via landmark-by-landmark browsing."
    },

    "image-alt": {
        title: "Images Missing Alternative Text",
        explanation: "One or more <img> elements do not have an alt attribute.",
        whyItMatters: "Screen readers announce the file URL when an image lacks alt text, which is confusing and jarring. Non-sighted users are unable to perceive what the image depicts.",
        solution: "Add an alt attribute describing the image content. For purely decorative graphics, set alt=\"\" to signal assistive technology to bypass it.",
        generateCodeExample: (sampleHtml) => {
            return `<!-- Before -->\n<img src="logo.png">\n\n<!-- Corrected: Informative image -->\n<img src="logo.png" alt="Company Logo">\n\n<!-- Corrected: Decorative icon -->\n<img src="divider.svg" alt="" aria-hidden="true">`;
        },
        expectedImprovement: "Screen readers read meaningful text alternatives or silently skip decorative background elements."
    },

    "button-name": {
        title: "Buttons Without Accessible Names",
        explanation: "One or more <button> elements lack discernible, readable text.",
        whyItMatters: "Screen readers announce 'button' with no name when a button has no inner text or aria-label, leaving users unable to know what action will trigger.",
        solution: "Include visible text inside the button or provide an aria-label attribute.",
        generateCodeExample: () => {
            return `<!-- Before: Icon-only button with no accessible name -->\n<button><svg>...</svg></button>\n\n<!-- Corrected: Using aria-label -->\n<button aria-label="Close dialog"><svg aria-hidden="true">...</svg></button>`;
        },
        expectedImprovement: "Screen readers announce both the role ('button') and the exact action ('Close dialog')."
    },

    "link-name": {
        title: "Links Without Accessible Names",
        explanation: "One or more hyperlinks (<a>) lack discernible text.",
        whyItMatters: "Users navigating links out of context via screen reader link dialogs cannot determine the target of an empty link.",
        solution: "Provide descriptive anchor text or add an aria-label explaining the link destination.",
        generateCodeExample: () => {
            return `<!-- Before: Empty icon link -->\n<a href="/profile"><i class="icon-user"></i></a>\n\n<!-- Corrected -->\n<a href="/profile" aria-label="View user profile"><i class="icon-user" aria-hidden="true"></i></a>`;
        },
        expectedImprovement: "Users can discern link destinations when browsing alphabetically in screen reader link menus."
    },

    "label": {
        title: "Form Inputs Missing Associated Labels",
        explanation: "One or more form control elements do not have an explicit or programmatic label.",
        whyItMatters: "Screen reader users navigating into an input field need an auditory cue stating what information is expected. Placeholders are temporary visual cues and do not suffice as accessible labels.",
        solution: "Use a <label for=\"inputId\"> element paired with the input's id, or apply an aria-label attribute.",
        generateCodeExample: () => {
            return `<!-- Before -->\n<input type="email" placeholder="Your email">\n\n<!-- Corrected: Explicit label association -->\n<label for="user-email">Email Address</label>\n<input type="email" id="user-email" placeholder="name@example.com">`;
        },
        expectedImprovement: "Assistive technologies announce 'Email Address, edit text' as soon as focus enters the input."
    },

    "color-contrast": {
        title: "Insufficient Color Contrast",
        explanation: "Text element does not satisfy minimum color contrast ratio against its background.",
        whyItMatters: "Low contrast text is difficult or impossible to read for users with low vision, color blindness, or users viewing screens in bright daylight.",
        solution: "Increase color contrast to at least 4.5:1 for standard body text (or 3:1 for large text $\ge$ 18pt / 14pt bold).",
        generateCodeExample: () => {
            return `/* Before: Contrast ratio 1.8:1 (Fails WCAG AA) */\ncolor: #999999; background-color: #ffffff;\n\n/* Corrected: Contrast ratio 5.2:1 (Passes WCAG AA) */\ncolor: #595959; background-color: #ffffff;`;
        },
        expectedImprovement: "Ensures content is readable across diverse lighting conditions and visual acuities."
    },

    "html-has-lang": {
        title: "Missing Document Language Attribute",
        explanation: "The <html> element does not have a lang attribute.",
        whyItMatters: "Screen readers use the document lang attribute to load the proper pronunciation rules, dictionary, and speech synthesizer voice.",
        solution: "Add a valid BCP 47 language code to the <html> tag (e.g. lang=\"en\").",
        generateCodeExample: () => {
            return `<!-- Before -->\n<html>\n\n<!-- Corrected -->\n<html lang="en">`;
        },
        expectedImprovement: "Screen readers speak page text using the correct accent, phonetics, and translation cadence."
    },

    "document-title": {
        title: "Missing Page Title",
        explanation: "The document lacks a valid <title> element inside <head>.",
        whyItMatters: "The window title is the first item announced by screen readers upon loading a page. It is also used by browser tabs, bookmarks, and search result titles.",
        solution: "Add a descriptive <title> tag inside the <head> of the HTML document.",
        generateCodeExample: (sampleHtml, pageTitle) => {
            const titleText = pageTitle || "Dashboard - Web Application Analyzer";
            return `<!-- Before -->\n<head></head>\n\n<!-- Corrected -->\n<head>\n  <title>${titleText}</title>\n</head>`;
        },
        expectedImprovement: "Enables instant recognition in multi-tab browsing and screen reader page load announcements."
    }
};

/**
 * Generates structured AI recommendations for all detected accessibility violations.
 *
 * @param {Object} accessibilityData - The accessibility object returned by axe-core
 * @param {Object} context - Optional context { website_name, website_url, pageTitle }
 * @returns {Array<Object>} List of structured recommendations
 */
function generateAccessibilityRecommendations(accessibilityData, context = {}) {
    if (!accessibilityData || !Array.isArray(accessibilityData.violations)) {
        return [];
    }

    const { website_name, pageTitle } = context;
    const targetTitle = pageTitle || website_name || "Example Domain";

    return accessibilityData.violations.map((violation) => {
        const ruleId = violation.id;
        const impact = violation.impact || "moderate";
        const severity = impact.toLowerCase();
        const priority = mapPriority(impact);
        const wcagInfo = classifyWcagStatus(violation.wcagTags || violation.tags);

        const sampleNode = violation.nodes && violation.nodes.length > 0 ? violation.nodes[0] : null;
        const sampleHtml = sampleNode ? sampleNode.html : "";
        const selectors = violation.nodes ? violation.nodes.flatMap(n => n.target || []) : [];

        // Check if we have specialized knowledge for this rule
        const knowledge = ruleKnowledgeBase[ruleId];

        if (knowledge) {
            return {
                issueId: ruleId,
                title: knowledge.title,
                severity: severity,
                priority: priority,
                wcagCriteria: wcagInfo.criteria,
                isWcagFailure: wcagInfo.isWcagFailure,
                explanation: knowledge.explanation,
                whyItMatters: knowledge.whyItMatters,
                solution: knowledge.solution,
                codeExample: knowledge.generateCodeExample(sampleHtml, targetTitle),
                expectedImprovement: knowledge.expectedImprovement,
                affectedElementsCount: violation.affectedCount || (violation.nodes ? violation.nodes.length : 1),
                affectedSelectors: selectors.slice(0, 5)
            };
        }

        // Tailored fallback for rules not explicitly in the lookup dictionary
        const fallbackTitle = violation.help || ruleId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        const failureSummary = sampleNode?.failureSummary ? sampleNode.failureSummary.split("\n")[0] : violation.description;

        return {
            issueId: ruleId,
            title: fallbackTitle,
            severity: severity,
            priority: priority,
            wcagCriteria: wcagInfo.criteria,
            isWcagFailure: wcagInfo.isWcagFailure,
            explanation: violation.description || "Accessibility requirement was not satisfied by the target element.",
            whyItMatters: `Assistive technologies encounter barriers when ${fallbackTitle.toLowerCase()}. This violates usability principles for keyboard and screen reader accessibility.`,
            solution: failureSummary || "Update the affected HTML element to satisfy the corresponding WCAG accessibility specification.",
            codeExample: sampleHtml ? `<!-- Affected Element -->\n${sampleHtml}\n\n<!-- Refer to documentation: ${violation.helpUrl || "https://dequeuniversity.com/rules/axe/"} -->` : `<!-- Ensure element complies with rule ${ruleId} -->`,
            expectedImprovement: "Resolves accessibility linter errors and improves compatibility across assistive devices.",
            affectedElementsCount: violation.affectedCount || (violation.nodes ? violation.nodes.length : 1),
            affectedSelectors: selectors.slice(0, 5)
        };
    });
}

module.exports = {
    generateAccessibilityRecommendations,
    mapPriority,
    classifyWcagStatus
};
