const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: false,
  },
});

redisClient.on("error", () => {
  // ป้องกัน unhandled error เมื่อไม่มี Redis service
});

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("เชื่อมต่อ Redis สำเร็จ");
  } catch (err) {
    console.warn("คำเตือน: ไม่พบ Redis Service (เซิร์ฟเวอร์จะทำงานต่อโดยไม่มี Cache)");
  }
}

module.exports = { redisClient, connectRedis };
