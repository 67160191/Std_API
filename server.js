require("dotenv").config();
const app = require("./app");
const { connectRedis } = require("./cache");
const PORT = process.env.PORT || 3000;

connectRedis()
  .catch((err) => {
    console.warn("เชื่อมต่อ Redis ไม่สำเร็จ:", err.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server กำลังทำงานที่ http://localhost:${PORT} (${process.env.NODE_ENV})`);
    });
  });
