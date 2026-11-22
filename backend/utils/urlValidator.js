const dns = require("dns").promises;
const net = require("net");

// In-memory DNS validation cache with 60-second TTL for high performance during in-flight request filtering
const dnsCache = new Map();
const DNS_CACHE_TTL_MS = 60000;

/**
 * Checks if an IPv4 address is in private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean} true if private/internal/unsafe
 */
function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return true; // Malformed IP treated as unsafe
    }

    const [a, b] = parts;

    // 0.0.0.0/8 - Current network
    if (a === 0) return true;

    // 10.0.0.0/8 - Private
    if (a === 10) return true;

    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;

    // 169.254.0.0/16 - Link-local (Cloud metadata services like 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 - Private (172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true;

    // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 - TEST-NET
    if (a === 192 && b === 0 && parts[2] === 2) return true;
    if (a === 198 && b === 51 && parts[2] === 100) return true;
    if (a === 203 && b === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 - Reserved
    if (a >= 240) return true;

    return false;
}

/**
 * Checks if an IPv6 address is in loopback, unique local, link-local, or IPv4-mapped private range.
 * @param {string} ip
 * @returns {boolean} true if private/internal/unsafe
 */
function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase();

    // Loopback
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
    // Unspecified
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

    // Link-local: fe80::/10
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
        normalized.startsWith("fea") || normalized.startsWith("feb")) {
        return true;
    }

    // Unique local: fc00::/7 (fc00:: - fdff::)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
        return true;
    }

    // IPv4-mapped IPv6: ::ffff:192.0.2.128
    if (normalized.startsWith("::ffff:")) {
        const ipv4Part = normalized.replace("::ffff:", "");
        if (net.isIPv4(ipv4Part)) {
            return isPrivateIPv4(ipv4Part);
        }
    }

    return false;
}

/**
 * Validates a target URL against SSRF and network isolation rules.
 * @param {string} urlString
 * @returns {Promise<{ isValid: boolean, error?: string, sanitizedUrl?: string }>}
 */
async function validateTargetUrl(urlString) {
    if (!urlString || typeof urlString !== "string") {
        return { isValid: false, error: "Website URL must be a non-empty string." };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(urlString.trim());
    } catch {
        return { isValid: false, error: "Invalid website URL format." };
    }

    // 1. Protocol validation: Only HTTP and HTTPS
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return {
            isValid: false,
            error: `Protocol '${parsedUrl.protocol}' is not allowed. Only HTTP and HTTPS are permitted.`
        };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 2. Reject obvious localhost, loopback, and internal names
    const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"];
    if (blockedHostnames.includes(hostname)) {
        return {
            isValid: false,
            error: "Scanning localhost or loopback addresses is blocked for security (SSRF prevention)."
        };
    }

    // Reject internal top-level domains
    const blockedSuffixes = [".local", ".internal", ".localhost", ".test", ".example", ".invalid", ".arpa"];
    if (blockedSuffixes.some(suffix => hostname.endsWith(suffix))) {
        return {
            isValid: false,
            error: "Scanning internal or reserved domain names is blocked for security."
        };
    }

    // Check cache
    const now = Date.now();
    const cached = dnsCache.get(hostname);
    if (cached && (now - cached.timestamp < DNS_CACHE_TTL_MS)) {
        if (!cached.isValid) {
            return { isValid: false, error: cached.error };
        }
        return { isValid: true, sanitizedUrl: parsedUrl.href };
    }

    // 3. If hostname is directly an IP literal
    if (net.isIP(hostname)) {
        if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
            const err = "Scanning private or internal IP addresses is blocked for security (SSRF prevention).";
            dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
            return { isValid: false, error: err };
        }
        if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
            const err = "Scanning private or internal IPv6 addresses is blocked for security (SSRF prevention).";
            dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
            return { isValid: false, error: err };
        }
    } else {
        // 4. Resolve DNS to detect DNS rebinding or private IP aliases
        try {
            const addresses = await dns.lookup(hostname, { all: true });
            if (!addresses || addresses.length === 0) {
                const err = `Unable to resolve DNS for host '${hostname}'.`;
                dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
                return { isValid: false, error: err };
            }

            for (const addr of addresses) {
                if (addr.family === 4 && isPrivateIPv4(addr.address)) {
                    const err = `Host '${hostname}' resolves to private IP (${addr.address}), which is blocked for security.`;
                    dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
                    return { isValid: false, error: err };
                }
                if (addr.family === 6 && isPrivateIPv6(addr.address)) {
                    const err = `Host '${hostname}' resolves to private IPv6 (${addr.address}), which is blocked for security.`;
                    dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
                    return { isValid: false, error: err };
                }
            }
        } catch (dnsErr) {
            const err = `DNS resolution failed for '${hostname}': ${dnsErr.message}`;
            dnsCache.set(hostname, { isValid: false, error: err, timestamp: now });
            return { isValid: false, error: err };
        }
    }

    dnsCache.set(hostname, { isValid: true, timestamp: now });
    return { isValid: true, sanitizedUrl: parsedUrl.href };
}

module.exports = {
    validateTargetUrl,
    isPrivateIPv4,
    isPrivateIPv6
};
