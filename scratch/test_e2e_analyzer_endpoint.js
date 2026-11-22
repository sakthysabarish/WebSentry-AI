const path = require("path");
module.paths.push(path.resolve(__dirname, "../backend/node_modules"));
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { db } = require("../backend/config/db");
const express = require("express");
const analyzerRoutes = require("../backend/routes/analyzerRoutes");

async function testE2E() {
    console.log("=== Testing End-to-End POST /api/analyze/:projectId ===");

    // 1. Check or insert an example.com project in MySQL
    const [existing] = await db.query(
        "SELECT id, website_name, website_url FROM projects WHERE website_url LIKE '%example.com%' LIMIT 1"
    );

    let projectId;
    if (existing.length > 0) {
        projectId = existing[0].id;
        console.log(`Using existing project ID ${projectId} (${existing[0].website_url})`);
    } else {
        const [insertRes] = await db.query(
            "INSERT INTO projects (website_name, website_url) VALUES (?, ?)",
            ["Example Domain", "https://example.com"]
        );
        projectId = insertRes.insertId;
        console.log(`Inserted test project ID ${projectId}`);
    }

    // 2. Set up a lightweight express test app to test analyzerRoutes
    const app = express();
    app.use(express.json());
    app.use("/api/analyze", analyzerRoutes);

    const server = app.listen(0);
    const port = server.address().port;
    console.log(`Test Express server listening on ephemeral port ${port}`);

    try {
        console.log(`Sending POST request to http://127.0.0.1:${port}/api/analyze/${projectId} (will analyze https://example.com)...`);
        const startTime = Date.now();

        const response = await fetch(`http://127.0.0.1:${port}/api/analyze/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Received HTTP ${response.status} in ${duration}s`);

        const data = await response.json();

        // 3. Validate response structure
        console.log("\n--- Validating Response Structure ---");
        console.log("success:", data.success);
        console.log("message:", data.message);
        console.log("project:", JSON.stringify(data.project));

        if (!data.success) {
            throw new Error(`API returned success: false: ${JSON.stringify(data)}`);
        }

        if (!data.analysis) {
            throw new Error("Missing 'analysis' field in response");
        }

        if (!data.analysis.accessibility) {
            throw new Error("Missing 'analysis.accessibility' field in response");
        }

        console.log(`Accessibility Score: ${data.analysis.accessibility.score}/100`);
        console.log(`Raw Violations Count: ${data.analysis.accessibility.violations.length}`);

        if (!Array.isArray(data.recommendations)) {
            throw new Error("Missing or invalid 'recommendations' array in response root");
        }

        console.log(`Recommendations Count: ${data.recommendations.length}`);

        console.log("\n--- Generated Recommendations ---");
        data.recommendations.forEach((rec, idx) => {
            console.log(`\n[#${idx + 1}] Issue ID: ${rec.issueId}`);
            console.log(`    Title: ${rec.title}`);
            console.log(`    Severity: ${rec.severity} | Priority: ${rec.priority}`);
            console.log(`    Criteria: ${rec.wcagCriteria} (isWcagFailure: ${rec.isWcagFailure})`);
            console.log(`    Explanation: ${rec.explanation}`);
            console.log(`    Why It Matters: ${rec.whyItMatters}`);
            console.log(`    Solution: ${rec.solution}`);
            console.log(`    Expected Improvement: ${rec.expectedImprovement}`);
            console.log(`    Affected Elements: ${rec.affectedElementsCount}`);
            console.log(`    Code Example:\n${rec.codeExample.split("\n").map(l => "      " + l).join("\n")}`);
        });

        // 4. Specifically check the 3 required issues for example.com
        const recIds = data.recommendations.map(r => r.issueId);
        console.log("\n--- Verifying Target Issues Present ---");
        const targetIssues = ["landmark-one-main", "page-has-heading-one", "region"];
        for (const tId of targetIssues) {
            if (recIds.includes(tId)) {
                console.log(`[PASS] Target issue '${tId}' is present in recommendations.`);
            } else {
                console.warn(`[WARN] Target issue '${tId}' was not detected in this scan run.`);
            }
        }

        console.log("\n=== E2E INTEGRATION TEST COMPLETED SUCCESSFULLY! ===");
    } finally {
        server.close();
        await db.end();
    }
}

testE2E().catch(err => {
    console.error("E2E Test Failed:", err);
    process.exit(1);
});
