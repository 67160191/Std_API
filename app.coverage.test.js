/**
 * app.coverage.test.js
 * เป้าหมาย: ดัน coverage ของ app.js ให้เกิน 70% ในทุก metric
 * ใช้ jest.mock สำหรับ db และ cache เพื่อไม่ต้องต่อ dependency จริง
 */

jest.mock("./db");
jest.mock("./cache", () => ({
  redisClient: { del: jest.fn().mockResolvedValue(1) },
  connectRedis: jest.fn(),
}));

const pool = require("./db");
const { redisClient } = require("./cache");
const request = require("supertest");
const app = require("./app");
const { generateToken } = require("./auth-helpers");

const adminToken = generateToken({ id: 1, email: "admin@test.com", role: "admin" });
const studentToken = generateToken({ id: 2, email: "student@test.com", role: "student" });

beforeEach(() => {
  jest.clearAllMocks();
  redisClient.del.mockResolvedValue(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// requireJson middleware
// ─────────────────────────────────────────────────────────────────────────────
describe("requireJson middleware", () => {
  test("ควรคืน 415 เมื่อ POST ไม่มี Content-Type: application/json", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Content-Type", "text/plain")
      .send("raw body");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  test("ควรผ่านได้เมื่อ GET (ไม่ถูก block โดย requireJson)", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /", () => {
  test("ควรคืน 200 พร้อม message", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Student API พร้อมใช้งาน");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────────────────────
describe("404 handler", () => {
  test("ควรคืน 404 เมื่อ route ไม่มีอยู่ในระบบ", async () => {
    const res = await request(app).get("/not-exist-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────────────────────────────────────
describe("Global error handler", () => {
  test("ควรคืน 500 เมื่อ DB error ใน GET /api/v1/students/:id", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get("/api/v1/students/1");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  test("ควรคืน status จาก err.status เมื่อ error มี status property", async () => {
    const customErr = Object.assign(new Error("Payload Too Large"), {
      status: 413,
      type: "entity.too.large",
    });
    pool.query.mockRejectedValueOnce(customErr);

    const res = await request(app).get("/api/v1/students/99");
    expect(res.status).toBe(413);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/students
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v1/students", () => {
  const mockRows = [
    { id: 1, name: "Alice", major: "CS", email: "alice@test.com" },
    { id: 2, name: "Bob", major: "IT", email: "bob@test.com" },
  ];

  test("ควรคืน 200 พร้อม list นักศึกษา (ไม่ filter major)", async () => {
    pool.query
      .mockResolvedValueOnce([mockRows])
      .mockResolvedValueOnce([[{ total: 2 }]]);

    const res = await request(app).get("/api/v1/students");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toBeDefined();
  });

  test("ควรคืน 200 พร้อม list นักศึกษา (filter ด้วย major)", async () => {
    pool.query
      .mockResolvedValueOnce([[mockRows[0]]])
      .mockResolvedValueOnce([[{ total: 1 }]]);

    const res = await request(app).get("/api/v1/students?major=CS");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test("ควรคืน 500 เมื่อ DB error", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get("/api/v1/students");
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/students
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/students", () => {
  test("ควรคืน 200 พร้อม items และ count", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);

    const res = await request(app).get("/api/v2/students");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.count).toBe(2);
  });

  test("ควรคืน 500 เมื่อ DB error", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get("/api/v2/students");
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/students/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v1/students/:id", () => {
  test("ควรคืน 200 เมื่อพบนักศึกษา", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, name: "Alice" }]]);

    const res = await request(app).get("/api/v1/students/1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  test("ควรคืน 404 เมื่อไม่พบนักศึกษา", async () => {
    pool.query.mockResolvedValueOnce([[]]); // empty rows

    const res = await request(app).get("/api/v1/students/999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/students
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v1/students", () => {
  test("ควรคืน 201 เมื่อข้อมูลครบถ้วน", async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 10 }]);

    const res = await request(app)
      .post("/api/v1/students")
      .send({
        name: "Charlie",
        major: "IT",
        email: "charlie@test.com",
        age: 20,
        studentType: "local",
        nationalId: "1234567890123",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(10);
  });

  test("ควรคืน 400 เมื่อข้อมูลไม่ครบ", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .send({ name: "Charlie" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("ควรคืน 400 เมื่อ studentType=international แต่ไม่ระบุ passportNumber", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .send({
        name: "John Smith",
        email: "john@example.com",
        age: 22,
        studentType: "international",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("passportNumber");
  });

  test("ควรคืน 400 เมื่อ studentType=local แต่ไม่ระบุ nationalId", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .send({
        name: "Somchai",
        email: "somchai@example.com",
        age: 20,
        studentType: "local",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("nationalId");
  });

  test("ควรคืน 409 เมื่อ email ซ้ำ (ER_DUP_ENTRY)", async () => {
    const dupErr = Object.assign(new Error("Duplicate"), { code: "ER_DUP_ENTRY" });
    pool.query.mockRejectedValueOnce(dupErr);

    const res = await request(app)
      .post("/api/v1/students")
      .send({
        name: "Dave",
        major: "CS",
        email: "dup@test.com",
        age: 21,
        studentType: "local",
        nationalId: "1234567890124",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  test("ควรคืน 500 เมื่อ DB error อื่น ๆ", async () => {
    pool.query.mockRejectedValueOnce(new Error("Unknown error"));

    const res = await request(app)
      .post("/api/v1/students")
      .send({
        name: "Eve",
        major: "CS",
        email: "eve@test.com",
        age: 22,
        studentType: "local",
        nationalId: "1234567890125",
      });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/students/:id/enrollments
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v1/students/:id/enrollments", () => {
  const mockConn = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };

  beforeEach(() => {
    pool.getConnection = jest.fn().mockResolvedValue(mockConn);
    mockConn.beginTransaction.mockClear();
    mockConn.query.mockClear();
    mockConn.commit.mockClear();
    mockConn.rollback.mockClear();
    mockConn.release.mockClear();
  });

  test("ควรคืน 201 เมื่อลงทะเบียนสำเร็จ", async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ id: 1, seat_available: 5 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("ลงทะเบียนสำเร็จ");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  test("ควรคืน 404 เมื่อไม่พบ course", async () => {
    mockConn.query.mockResolvedValueOnce([[]]); // empty

    const res = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 99 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("COURSE_NOT_FOUND");
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  test("ควรคืน 409 เมื่อที่นั่งเต็ม (seat_available = 0)", async () => {
    mockConn.query.mockResolvedValueOnce([[{ id: 1, seat_available: 0 }]]);

    const res = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SEAT_FULL");
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  test("ควรคืน 409 ALREADY_ENROLLED เมื่อ ER_DUP_ENTRY", async () => {
    const dupErr = Object.assign(new Error("Duplicate"), { code: "ER_DUP_ENTRY" });
    mockConn.query
      .mockResolvedValueOnce([[{ id: 1, seat_available: 5 }]])
      .mockRejectedValueOnce(dupErr);

    const res = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_ENROLLED");
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  test("ควรคืน 500 เมื่อ DB error อื่น ๆ", async () => {
    mockConn.query.mockRejectedValueOnce(new Error("DB crash"));

    const res = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(res.status).toBe(500);
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/students/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/v1/students/:id", () => {
  test("ควรคืน 200 เมื่อลบสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("ลบข้อมูลสำเร็จ");
  });

  test("ควรคืน 404 เมื่อไม่พบนักศึกษาที่จะลบ", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app)
      .delete("/api/v1/students/999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืน 403 เมื่อ role เป็น student", async () => {
    const res = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test("ควรคืน 500 เมื่อ DB error", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register (mocked)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/register (mocked)", () => {
  test("ควรคืน 201 เมื่อสมัครสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 5 }]);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "new@test.com", password: "Passw0rd!" });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("student");
  });

  test("ควรคืน 400 เมื่อไม่ระบุ email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ password: "Passw0rd!" });

    expect(res.status).toBe(400);
  });

  test("ควรคืน 409 เมื่อ email ซ้ำ", async () => {
    const dupErr = Object.assign(new Error("Duplicate"), { code: "ER_DUP_ENTRY" });
    pool.query.mockRejectedValueOnce(dupErr);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "dup@test.com", password: "Passw0rd!" });

    expect(res.status).toBe(409);
  });

  test("ควรคืน 500 เมื่อ DB error อื่น ๆ", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "err@test.com", password: "Passw0rd!" });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login – branches เพิ่มเติม (mocked)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/login – extra branches (mocked)", () => {
  const { hashPassword } = require("./auth-helpers");

  test("ควรคืน 401 เมื่อ password ไม่ถูกต้อง", async () => {
    const hash = await hashPassword("correct_password");
    pool.query.mockResolvedValueOnce([
      [{ id: 1, email: "x@test.com", password_hash: hash, role: "student" }],
    ]);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "x@test.com", password: "wrong_password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("ควรคืน 400 เมื่อไม่ระบุ email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ password: "Passw0rd!" });

    expect(res.status).toBe(400);
  });
});
