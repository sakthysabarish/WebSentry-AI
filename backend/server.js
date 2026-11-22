const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { testConnection } = require("./config/db");
const projectRoutes = require("./routes/projectRoutes");
const analyzerRoutes = require("./routes/analyzerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve generated screenshots statically
app.use("/screenshots", express.static(path.join(__dirname, "public/screenshots")));

// Home API
app.get("/", (req, res) => {
    res.json({
        message: "WebSentry AI API is running!"
    });
});

// Health Check API
app.get("/api/health", (req, res) => {
    res.json({
        status: "Online",
        application: "WebSentry AI"
    });
});

// Routes
app.use("/api/projects", projectRoutes);
app.use("/api/analyze", analyzerRoutes);

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await testConnection();
});