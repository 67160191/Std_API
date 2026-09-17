require("dotenv").config();
const request = require("supertest");
const app = require("./app");
const { generateToken } = require("./auth-helpers");
const { authorizeRole } = require("./middlewares/auth");

describe("Auth & RBAC Middleware", () => {
  describe("authenticateToken middleware", () => {
    test("ควรคืน 401 เมื่อ token ผิดรูปแบบ (แก้ไขตัวอักษรบางส่วน)", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("INVALID_TOKEN");
    });
  });

  describe("RBAC middleware (authorizeRole)", () => {
    test("ควรคืน 403 เมื่อ role ไม่มีสิทธิ์เข้าถึง route", async () => {
      const studentToken = generateToken({
        id: 999,
        email: "student@example.com",
        role: "student",
      });

      // DELETE /api/v1/students/:id กำหนด authorizeRole("admin")
      const response = await request(app)
        .delete("/api/v1/students/1")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    test("ควรคืน 401 เมื่อ authorizeRole ถูกเรียกโดยไม่มีข้อมูล req.user", () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authorizeRole("admin")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: "NO_TOKEN" }),
        }),
      );
    });

    test("ควรเรียก next() เมื่อ role มีสิทธิ์เข้าถึง", () => {
      const req = { user: { id: 1, role: "admin" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authorizeRole("admin")(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
