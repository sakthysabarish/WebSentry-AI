const express = require("express");
const router = express.Router();
const { db } = require("../config/db");

/**
 * @route   POST /api/projects
 * @desc    Register / create a new project
 * @access  Public
 */
router.post("/", async (req, res) => {
    try {
        const { website_name, website_url } = req.body;

        // 1. Validate required fields
        if (!website_name || !website_url) {
            return res.status(400).json({
                success: false,
                message: "website_name and website_url are required fields."
            });
        }

        const trimmedName = String(website_name).trim();
        const trimmedUrl = String(website_url).trim();

        // 2. Validate non-empty values
        if (!trimmedName || !trimmedUrl) {
            return res.status(400).json({
                success: false,
                message: "website_name and website_url cannot be empty."
            });
        }

        // 3. Length validation (based on MySQL table schema)
        if (trimmedName.length > 150) {
            return res.status(400).json({
                success: false,
                message: "website_name exceeds maximum length of 150 characters."
            });
        }

        if (trimmedUrl.length > 500) {
            return res.status(400).json({
                success: false,
                message: "website_url exceeds maximum length of 500 characters."
            });
        }

        // 4. Validate URL format
        try {
            const parsedUrl = new URL(trimmedUrl);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                return res.status(400).json({
                    success: false,
                    message: "website_url must start with http:// or https://"
                });
            }
        } catch (urlErr) {
            return res.status(400).json({
                success: false,
                message: "Invalid website_url format. Please provide a valid URL (e.g. https://example.com)."
            });
        }

        // 5. Insert into MySQL using parameterized query
        const sql = "INSERT INTO projects (website_name, website_url) VALUES (?, ?)";
        const [result] = await db.query(sql, [trimmedName, trimmedUrl]);

        return res.status(201).json({
            success: true,
            message: "Project registered successfully!",
            projectId: result.insertId,
            project: {
                id: result.insertId,
                website_name: trimmedName,
                website_url: trimmedUrl
            }
        });
    } catch (error) {
        console.error("Error in POST /api/projects:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to create project due to internal server error.",
            error: error.message
        });
    }
});

/**
 * @route   GET /api/projects
 * @desc    Retrieve all registered projects
 * @access  Public
 */
router.get("/", async (req, res) => {
    try {
        const sql = "SELECT id, website_name, website_url, created_at FROM projects ORDER BY created_at DESC";
        const [projects] = await db.query(sql);

        return res.status(200).json({
            success: true,
            count: projects.length,
            projects: projects
        });
    } catch (error) {
        console.error("Error in GET /api/projects:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch projects due to internal server error.",
            error: error.message
        });
    }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Retrieve a specific project by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Validate numeric ID
        const projectId = parseInt(id, 10);
        if (isNaN(projectId) || projectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID. It must be a positive number."
            });
        }

        const sql = "SELECT id, website_name, website_url, created_at FROM projects WHERE id = ?";
        const [rows] = await db.query(sql, [projectId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Project with ID ${projectId} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            project: rows[0]
        });
    } catch (error) {
        console.error("Error in GET /api/projects/:id:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch project due to internal server error.",
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project by ID
 * @access  Public
 */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Validate numeric ID
        const projectId = parseInt(id, 10);
        if (isNaN(projectId) || projectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID. It must be a positive number."
            });
        }

        const sql = "DELETE FROM projects WHERE id = ?";
        const [result] = await db.query(sql, [projectId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: `Project with ID ${projectId} not found.`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Project with ID ${projectId} was successfully deleted.`
        });
    } catch (error) {
        console.error("Error in DELETE /api/projects/:id:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to delete project due to internal server error.",
            error: error.message
        });
    }
});

module.exports = router;
