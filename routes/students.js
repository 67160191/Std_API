const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middlewares/auth");
const { getStudentEnrichment } = require("../services/enrichment-service");
const { createStudentSchema } = require("../schemas/studentSchema");
const pool = require("../db");
const { redisClient } = require("../cache");

// Middleware ตรวจสอบ token แบบ optional (เพื่อรองรับทั้งแบบแนบ token และไม่แนบ token)
function optionalAuth(req, res, next) {
  if (req.headers["authorization"]) {
    return authenticateToken(req, res, next);
  }
  next();
}

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

// สัปดาห์ที่ 12: Conditional Validation สำหรับการเพิ่มข้อมูลนักศึกษา
router.post("/", optionalAuth, async (req, res, next) => {
  const result = createStudentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  const { name, email } = result.data;
  const major = result.data.major || req.body.major || "General";

  try {
    const [dbResult] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );

    await redisClient.del("students:all");

    return res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: { id: dbResult.insertId, name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

module.exports = router;
