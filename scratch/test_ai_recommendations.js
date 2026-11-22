const path = require("path");
const { generateAccessibilityRecommendations, classifyWcagStatus, mapPriority } = require("../backend/services/aiRecommendationService");

async function runTests() {
    console.log("=== Testing AI Recommendation Service ===\n");

    // Test 1: Simulated axe-core violations from example.com
    const mockExampleComViolations = {
        violations: [
            {
                id: "landmark-one-main",
                impact: "moderate",
                tags: ["cat.semantics", "best-practice"],
                description: "Ensure the document has a main landmark",
                help: "Document must have one main landmark",
                helpUrl: "https://dequeuniversity.com/rules/axe/4.10/landmark-one-main",
                nodes: [
                    {
                        html: "<html lang=\"en\">",
                        target: ["html"]
                    }
                ],
                affectedCount: 1
            },
            {
                id: "page-has-heading-one",
                impact: "moderate",
                tags: ["cat.semantics", "best-practice"],
                description: "Ensure that the page, or at least one of its frames contains a level-one heading",
                help: "Page must contain a level-one heading",
                helpUrl: "https://dequeuniversity.com/rules/axe/4.10/page-has-heading-one",
                nodes: [
                    {
                        html: "<html lang=\"en\">",
                        target: ["html"]
                    }
                ],
                affectedCount: 1
            },
            {
                id: "region",
                impact: "moderate",
                tags: ["cat.keyboard", "best-practice"],
                description: "Ensure all page content is contained by landmarks",
                help: "All page content should be contained by landmarks",
                helpUrl: "https://dequeuniversity.com/rules/axe/4.10/region",
                nodes: [
                    { html: "<p>This domain is for use in documentation examples...</p>", target: ["body > div > p:nth-child(2)"] },
                    { html: "<p><a href=\"https://www.iana.org/domains/example\">More information...</a></p>", target: ["body > div > p:nth-child(3)"] },
                    { html: "<div>...", target: ["div"] }
                ],
                affectedCount: 7
            }
        ]
    };

    const context = {
        website_name: "Example Domain Test",
        website_url: "https://example.com",
        pageTitle: "Example Domain"
    };

    const recs = generateAccessibilityRecommendations(mockExampleComViolations, context);

    console.log(`Generated ${recs.length} recommendations.\n`);

    let allPassed = true;

    // Check each issue
    const expectedIds = ["landmark-one-main", "page-has-heading-one", "region"];
    for (const expId of expectedIds) {
        const item = recs.find(r => r.issueId === expId);
        if (!item) {
            console.error(`FAILED: Missing recommendation for ${expId}`);
            allPassed = false;
            continue;
        }

        console.log(`--- [PASS] Verified Issue: ${item.issueId} ---`);
        console.log(`  Title: ${item.title}`);
        console.log(`  Severity: ${item.severity} | Priority: ${item.priority}`);
        console.log(`  isWcagFailure: ${item.isWcagFailure} (${item.wcagCriteria})`);
        console.log(`  Explanation: ${item.explanation}`);
        console.log(`  Why It Matters: ${item.whyItMatters.slice(0, 80)}...`);
        console.log(`  Solution: ${item.solution}`);
        console.log(`  Expected Improvement: ${item.expectedImprovement}`);
        console.log(`  Code Example:\n${item.codeExample.split("\n").map(l => "    " + l).join("\n")}\n`);

        // Assert essential fields
        const requiredFields = ["issueId", "title", "severity", "priority", "explanation", "solution", "codeExample"];
        for (const f of requiredFields) {
            if (!item[f]) {
                console.error(`  ERROR: Missing field ${f} in recommendation for ${expId}`);
                allPassed = false;
            }
        }

        // Verify before & after comments are present in codeExample
        if (!item.codeExample.includes("Before") || !item.codeExample.includes("Corrected")) {
            console.error(`  ERROR: codeExample does not contain Before and Corrected sections`);
            allPassed = false;
        }
    }

    // Test 2: Official WCAG violation mapping (e.g., color-contrast)
    const wcagViolation = {
        violations: [
            {
                id: "color-contrast",
                impact: "serious",
                tags: ["cat.color", "wcag2aa", "wcag143"],
                nodes: [{ html: "<p style=\"color: #ccc\">Faint text</p>" }]
            }
        ]
    };
    const wcagRecs = generateAccessibilityRecommendations(wcagViolation);
    if (wcagRecs[0].isWcagFailure !== true || !wcagRecs[0].wcagCriteria.includes("WCAG2AA")) {
        console.error("FAILED: WCAG failure classification test failed for color-contrast");
        allPassed = false;
    } else {
        console.log("--- [PASS] Verified WCAG Failure classification (color-contrast) ---");
        console.log(`  isWcagFailure: ${wcagRecs[0].isWcagFailure}, criteria: ${wcagRecs[0].wcagCriteria}, priority: ${wcagRecs[0].priority}\n`);
    }

    if (allPassed) {
        console.log("ALL AI RECOMMENDATION UNIT TESTS PASSED SUCCESSFULLY!");
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
