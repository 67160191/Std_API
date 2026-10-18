// gateway/generate-test-token.js (สคริปต์ชั่วคราวสำหรับทดสอบเท่านั้น)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const jwt = require("jsonwebtoken");

// payload ใช้คีย์ id/email/role เช่นเดียวกับ generateToken ในสัปดาห์ที่ 6
// เพื่อให้ req.user ที่ได้จาก Gateway มีโครงสร้างเดียวกับที่ route อื่นในระบบคาดหวัง
const token = jwt.sign(
  { id: 1, email: "test@example.com", role: "student" },
  process.env.JWT_SECRET || "lab-secret-key-for-classroom-use-only",
  { expiresIn: "1h" },
);

console.log(token);
module.exports = { token };
