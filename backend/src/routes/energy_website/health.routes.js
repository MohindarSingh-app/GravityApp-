const express = require("express");
const router = express.Router();

// GET /api/website/health
router.get("/health", (req, res) => {
  res.json({ success: true, app: "energy_website", status: "running" });
});

module.exports = router;
