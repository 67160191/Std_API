# URI Schema — Student API

ตารางต่อไปนี้แสดง URI Schema ทั้งหมดของระบบจัดการนักศึกษา (Student API) ที่พัฒนาด้วย Node.js + Express.js ประกอบด้วย REST API และ GraphQL endpoint โดยประยุกต์ใช้หลักการ Resource Naming, HTTP Method ที่ถูกต้อง และ Status Code ที่เหมาะสม

---

## REST API Endpoints

### 1. General

| Method | URI | คำอธิบาย | Status Code ที่เป็นไปได้ |
|--------|-----|-----------|--------------------------|
| GET | `/` | ตรวจสอบสถานะของ API (Health Check) | 200 |

---

### 2. Students `/api/v1/students`

| Method | URI | คำอธิบาย | Status Code ที่เป็นไปได้ |
|--------|-----|-----------|--------------------------|
| GET | `/api/v1/students` | ดึงรายชื่อนักศึกษาทั้งหมด | 200 |
| GET | `/api/v1/students/{id}` | ดึงข้อมูลนักศึกษารายบุคคล | 200, 404 |
| GET | `/api/v1/students/{id}?include=courses` | ดึงข้อมูลนักศึกษาพร้อมรายวิชาที่ลงทะเบียน (Query Parameter) | 200, 404 |
| GET | `/api/v1/students/{id}/full` | ดึงข้อมูลนักศึกษาพร้อมรายละเอียดวิชาครบถ้วน | 200, 404 |
| POST | `/api/v1/students` | เพิ่มนักศึกษาใหม่ | 201, 400, 409 |
| PUT | `/api/v1/students/{id}` | แก้ไขข้อมูลนักศึกษาทั้งระเบียน (name, major) | 200, 400, 404 |
| PATCH | `/api/v1/students/{id}` | แก้ไขข้อมูลนักศึกษาบางส่วน (name, major, email) | 200, 400, 404 |
| DELETE | `/api/v1/students/{id}` | ลบข้อมูลนักศึกษา | 200, 404 |

---

## GraphQL Endpoint

| Method | URI | คำอธิบาย | Status Code ที่เป็นไปได้ |
|--------|-----|-----------|--------------------------|
| GET / POST | `/graphql` | GraphQL endpoint สำหรับ Query และ Mutation ทั้งหมด | 200, 400 |

### GraphQL Operations

#### Queries (อ่านข้อมูล)

| Operation | คำอธิบาย | Arguments |
|-----------|-----------|-----------|
| `student(id)` | ดึงข้อมูลนักศึกษารายบุคคล | `id: ID!` |
| `students(major, sortBy)` | ดึงรายชื่อนักศึกษาทั้งหมด รองรับกรองตาม major และเรียงลำดับ | `major: String`, `sortBy: String` |
| `studentCount` | นับจำนวนนักศึกษาทั้งหมด | — |
| `course(id)` | ดึงข้อมูลรายวิชารายบุคคล | `id: ID!` |
| `courses(minCredit)` | ดึงรายการวิชาทั้งหมด รองรับกรองตามหน่วยกิตขั้นต่ำ | `minCredit: Int` |
| `searchStudents(keyword)` | ค้นหานักศึกษาตามชื่อหรือสาขาวิชา | `keyword: String!` |

#### Mutations (เขียน/แก้ไข/ลบข้อมูล)

| Operation | คำอธิบาย | Arguments |
|-----------|-----------|-----------|
| `createStudent(input)` | เพิ่มนักศึกษาใหม่ | `input: CreateStudentInput!` |
| `updateStudent(id, input)` | แก้ไขข้อมูลนักศึกษา (บางส่วนหรือทั้งหมด) | `id: ID!`, `input: UpdateStudentInput!` |
| `deleteStudent(id)` | ลบข้อมูลนักศึกษา | `id: ID!` |

---

## Status Code Reference

| Status Code | ความหมาย | สถานการณ์ที่ใช้ |
|-------------|----------|----------------|
| 200 OK | สำเร็จ | ดึง / แก้ไข / ลบข้อมูลสำเร็จ |
| 201 Created | สร้างข้อมูลสำเร็จ | POST เพิ่มนักศึกษาใหม่สำเร็จ |
| 400 Bad Request | ข้อมูลไม่ถูกต้องหรือไม่ครบถ้วน | ส่ง body ขาด field ที่จำเป็น |
| 404 Not Found | ไม่พบข้อมูล | ระบุ id ที่ไม่มีในระบบ |
| 409 Conflict | ข้อมูลซ้ำกัน | email ซ้ำกับที่มีอยู่ในระบบ |
