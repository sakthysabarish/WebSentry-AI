const axeCore = require("axe-core");

/**
 * Calculates an automated accessibility score from 0 to 100 based on WCAG violation severity.
 * 
 * Scoring Methodology:
 * - Baseline score: 100 points
 * - Deductions per affected element node:
 *   - Critical: -5.0 points per element
 *   - Serious:  -3.0 points per element
 *   - Moderate: -1.5 points per element
 *   - Minor:    -0.5 points per element
 * - Clamped between 0 and 100.
 *
 * Disclaimer:
 * This score is an automated programmatic estimation based on axe-core rule evaluation.
 * It does not constitute official WCAG certification or replace a manual accessibility audit.
 *
 * @param {number} criticalNodes
 * @param {number} seriousNodes
 * @param {number} moderateNodes
 * @param {number} minorNodes
 * @returns {number} Score from 0 to 100
 */
function calculateScore(criticalNodes, seriousNodes, moderateNodes, minorNodes) {
    const deductions = (criticalNodes * 5.0) + (seriousNodes * 3.0) + (moderateNodes * 1.5) + (minorNodes * 0.5);
    return Math.max(0, Math.min(100, Math.round(100 - deductions)));
}

/**
 * Executes an in-page axe-core accessibility audit on an existing Playwright Page instance.
 * Does NOT launch additional browser processes.
 *
 * @param {import("playwright").Page} page - Active Playwright page
 * @returns {Promise<Object>} Formatted accessibility audit results
 */
async function runAccessibilityAudit(page) {
    try {
        // Inject axe-core library into the current page context
        await page.evaluate(axeCore.source);

        // Run axe-core inside the page DOM
        const rawResults = await page.evaluate(async () => {
            return await window.axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
                }
            });
        });

        const rawViolations = rawResults.violations || [];

        let criticalRules = 0;
        let seriousRules = 0;
        let moderateRules = 0;
        let minorRules = 0;

        let criticalNodes = 0;
        let seriousNodes = 0;
        let moderateNodes = 0;
        let minorNodes = 0;

        // Format violations with detailed node information and WCAG mapping
        const formattedViolations = rawViolations.map((v) => {
            const impact = (v.impact || "minor").toLowerCase();
            const nodeCount = v.nodes ? v.nodes.length : 0;

            // Count by severity
            if (impact === "critical") {
                criticalRules++;
                criticalNodes += nodeCount;
            } else if (impact === "serious") {
                seriousRules++;
                seriousNodes += nodeCount;
            } else if (impact === "moderate") {
                moderateRules++;
                moderateNodes += nodeCount;
            } else {
                minorRules++;
                minorNodes += nodeCount;
            }

            // Extract WCAG tags (e.g. wcag2a, wcag143, etc.)
            const wcagTags = (v.tags || []).filter(t => t.startsWith("wcag") || t.startsWith("best-practice"));

            // Detailed affected nodes
            const affectedNodes = (v.nodes || []).slice(0, 10).map((n) => ({
                target: n.target || [],
                html: n.html ? n.html.slice(0, 300) : "",
                failureSummary: n.failureSummary || null
            }));

            return {
                id: v.id,
                impact: impact,
                description: v.description,
                help: v.help,
                helpUrl: v.helpUrl,
                wcagTags: wcagTags,
                affectedCount: nodeCount,
                nodes: affectedNodes
            };
        });

        // Calculate score
        const score = calculateScore(criticalNodes, seriousNodes, moderateNodes, minorNodes);

        return {
            score,
            scoringMethod: "Weighted deduction per affected element: Critical (-5), Serious (-3), Moderate (-1.5), Minor (-0.5). Automated estimate, not official WCAG certification.",
            totalViolations: formattedViolations.length,
            critical: criticalRules,
            serious: seriousRules,
            moderate: moderateRules,
            minor: minorRules,
            totalAffectedElements: criticalNodes + seriousNodes + moderateNodes + minorNodes,
            passesCount: rawResults.passes ? rawResults.passes.length : 0,
            incompleteCount: rawResults.incomplete ? rawResults.incomplete.length : 0,
            violations: formattedViolations
        };

    } catch (error) {
        console.error("Accessibility analysis failed:", error.message);
        return {
            score: null,
            scoringMethod: "Unavailable due to audit execution failure.",
            error: `Axe-core execution failed: ${error.message}`,
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
}

module.exports = {
    runAccessibilityAudit,
    calculateScore
};
