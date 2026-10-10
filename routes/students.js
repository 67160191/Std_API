const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middlewares/auth");
const { getStudentEnrichment } = require("../services/enrichment-service");

// สัปดาห์ที่ 11: ข้อมูลเสริมจาก Public API ภายนอก พร้อม Retry/Timeout/Fallback
router.get("/:id/enrichment", authenticateToken, async (req, res, next) => {
  try {
    const enrichment = await getStudentEnrichment(req.params.id);

    return res.status(200).json({
      data: {
        studentId: req.params.id,
        enrichment,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
