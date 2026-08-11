# Student API

REST API สำหรับจัดการข้อมูลนักศึกษา พัฒนาด้วย Node.js และ Express.js

---

## โครงสร้างโปรเจกต์

```
student-api/
├── index.js          # จุดเริ่มต้นของแอปพลิเคชัน (Entry Point)
├── routes/
│   ├── students.js   # Router จัดการ endpoint ของนักศึกษา
│   └── courses.js    # Router จัดการ endpoint ของวิชาเรียน
├── package.json
└── README.md
```

- **`index.js`** — สร้าง Express app, กำหนด middleware และ mount router แต่ละตัวเข้ากับ base path
- **`routes/students.js`** — รวม route ทั้งหมดที่เกี่ยวกับนักศึกษา (GET, POST, PUT, DELETE)
- **`routes/courses.js`** — รวม route ทั้งหมดที่เกี่ยวกับวิชาเรียน

---

## API Endpoints

### Students `/api/v1/students`

| Method | Endpoint | คำอธิบาย |
|--------|----------|-----------|
| GET | `/api/v1/students` | ดึงรายชื่อนักศึกษาทั้งหมด (รองรับ `?major=...`) |
| GET | `/api/v1/students/:id` | ดึงข้อมูลนักศึกษารายบุคคล |
| POST | `/api/v1/students` | เพิ่มนักศึกษาใหม่ |
| PUT | `/api/v1/students/:id` | แก้ไขข้อมูลนักศึกษา |
| DELETE | `/api/v1/students/:id` | ลบข้อมูลนักศึกษา |

---

## การรันโปรเจกต์

```bash
# ติดตั้ง dependencies
npm install

# รันในโหมด development (auto-restart)
npm run dev

# รันในโหมด production
npm start
```

Server จะทำงานที่ `http://localhost:3000`

---

## ทบทวนคุณภาพโค้ด (Peer Review — ขั้นตอนที่ 3.2)

### 1. การตรวจสอบข้อมูลนำเข้า (Validation)

ทุก route ที่รับข้อมูลจากผู้ใช้มีการตรวจสอบเบื้องต้นก่อนประมวลผล เช่น
- ตรวจว่า `name` และ `major` ไม่ว่างเปล่า → ตอบกลับ `400 Bad Request`
- ตรวจว่า `name` มีความยาวอย่างน้อย 2 ตัวอักษร → ตอบกลับ `400 Bad Request`
- ตรวจว่าชื่อนักศึกษาซ้ำกับที่มีอยู่ → ตอบกลับ `409 Conflict`

### 2. Status Code ที่ใช้

| สถานการณ์ | Status Code |
|-----------|-------------|
| สำเร็จ (ดึงข้อมูล/แก้ไข/ลบ) | `200 OK` |
| สร้างข้อมูลใหม่สำเร็จ | `201 Created` |
| ข้อมูลที่ส่งมาไม่ครบ/ไม่ถูกต้อง | `400 Bad Request` |
| ไม่พบข้อมูลที่ต้องการ | `404 Not Found` |
| ข้อมูลซ้ำกัน | `409 Conflict` |

### 3. ปัญหาของการเขียน Route ทั้งหมดในไฟล์เดียว

หากมี route เพิ่มขึ้นอีก 10 เส้นทาง การเก็บโค้ดทุกอย่างไว้ในไฟล์เดียวจะก่อให้เกิดปัญหาดังนี้

1. **ไฟล์ขนาดใหญ่ อ่านยาก (Low Readability)** — โค้ดหลายร้อยบรรทัดในไฟล์เดียวทำให้ติดตาม logic ได้ยาก ต้องเลื่อนขึ้น-ลงตลอดเวลา
2. **บำรุงรักษายาก (Hard to Maintain)** — เมื่อต้องแก้ไข route ใด route หนึ่ง มีความเสี่ยงที่จะแก้ผิดส่วนและกระทบ route อื่นโดยไม่ตั้งใจ
3. **ทำงานร่วมกันในทีมลำบาก (Merge Conflicts)** — หลายคนแก้ไขไฟล์เดียวกันพร้อมกันจะเกิด conflict บ่อยครั้ง
4. **ละเมิด Single Responsibility Principle** — ไฟล์เดียวรับผิดชอบมากเกินไป ทั้ง config, middleware, และ business logic ของทุก resource

**วิธีแก้ไข** คือแยก route ออกเป็นไฟล์ย่อยใน `routes/` ตามแต่ละ resource (เช่นที่โปรเจกต์นี้ทำอยู่แล้ว) เพื่อให้แต่ละไฟล์รับผิดชอบเรื่องเดียว อ่านง่าย และดูแลรักษาได้ง่ายในระยะยาว
