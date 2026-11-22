const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { analyzeWebsite } = require("../services/analyzerService");
const { generateAccessibilityRecommendations } = require("../services/aiRecommendationService");

/**
 * @route   POST /api/analyze/:projectId
 * @desc    Launch Playwright automated website scanner for a registered project
 * @access  Public
 */
router.post("/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;

        // 1. Validate numeric project ID
        const id = parseInt(projectId, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID. Must be a positive integer."
            });
        }

        // 2. Fetch registered project from MySQL
        const sql = "SELECT id, website_name, website_url FROM projects WHERE id = ?";
        const [rows] = await db.query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Project with ID ${id} not found in the database. Please register it first.`
            });
        }

        const project = rows[0];

        // 3. Perform automated website analysis using Playwright
        const analysisData = await analyzeWebsite(project.website_url, project.id);

        // 4. Generate AI accessibility recommendations from actual axe-core audit data
        const recommendations = generateAccessibilityRecommendations(
            analysisData.accessibility,
            {
                website_name: project.website_name,
                website_url: project.website_url,
                pageTitle: analysisData.pageTitle
            }
        );

        return res.status(200).json({
            success: true,
            message: "Website analysis completed successfully.",
            project: {
                id: project.id,
                website_name: project.website_name,
                website_url: project.website_url
            },
            analysis: analysisData,
            recommendations: recommendations
        });

    } catch (error) {
        console.error("Analysis failed:", error.message);

        // Security / SSRF restriction block
        if (error.isSecurityBlock) {
            return res.status(403).json({
                success: false,
                errorType: "SECURITY_RESTRICTION",
                message: error.message
            });
        }

        // Navigation failure or timeout
        if (error.isNavigationError) {
            return res.status(504).json({
                success: false,
                errorType: "NAVIGATION_TIMEOUT",
                message: error.message
            });
        }

        // General server error
        return res.status(500).json({
            success: false,
            errorType: "ANALYZER_ERROR",
            message: "An error occurred while analyzing the website.",
            error: error.message
        });
    }
});

module.exports = router;
