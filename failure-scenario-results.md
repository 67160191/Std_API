# บันทึกผลการทดสอบ Failure Scenario

การทดสอบกลไก Retry, Timeout และ Fallback เมื่อเชื่อมต่อกับ External API (สัปดาห์ที่ 11)

---

## สรุปผลการทดสอบทั้ง 3 สถานการณ์

| สถานการณ์ | วิธีจำลอง | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง | ผ่าน/ไม่ผ่าน |
|---|---|---|---|:---:|
| **1. Network error (โดเมนไม่มีอยู่จริง)** | เปลี่ยน `url` ใน `enrichment-service.js` เป็น `https://this-domain-does-not-exist-12345.example` | ระบบตรวจพบว่าเป็น Network error (`!error.response`) ทำการ retry 2 ครั้งพร้อม exponential backoff + jitter แล้ว fallback ตอบกลับ 200 พร้อมข้อมูล fallback | ทำการ retry 2 ครั้ง (attempt 1/2: delay 620ms, attempt 2/2: delay 1661ms) พบ error `getaddrinfo ENOTFOUND` และส่ง fallback data (`source: "fallback"`, `available: false`) สำเร็จ | **ผ่าน** |
| **2. Timeout** | แก้ไข `fetchWithRetry(url, 1, 2)` โดยกำหนด timeout เป็น 1ms เพื่อให้เกิด timeout ทุกครั้ง | ระบบเกิด timeout (`ECONNABORTED`) ทำการ retry 2 ครั้งตามโควตาแล้ว fallback ตอบกลับ 200 อย่างปลอดภัย ไม่ทำให้ request ค้าง | ทำการ retry 2 ครั้ง (attempt 1/2: delay 605ms, attempt 2/2: delay 1299ms) พร้อม error `timeout of 1ms exceeded` และส่ง fallback data สำเร็จ | **ผ่าน** |
| **3. External API คืน Error Status 500** | รัน `mock-fail-server.js` (port 4000) ที่คืนสถานะ 500 และเปลี่ยน `url` เป็น `http://localhost:4000` | ฟังก์ชัน `isRetryable` ตรวจจับสถานะ 5xx และอนุญาตให้ retry 2 ครั้ง ก่อน fallback เมื่อครบโควตา | ทำการ retry 2 ครั้ง (attempt 1/2: delay 587ms, attempt 2/2: delay 1992ms) จาก error `Request failed with status code 500` และ fallback ได้ถูกต้อง | **ผ่าน** |

---

## รายละเอียดผลการทดสอบและ Log จริงในแต่ละสถานการณ์

### สถานการณ์ที่ 1: Network Error (เรียก URL ที่ไม่มีอยู่จริง)

- **วิธีจำลอง:** แก้ไข `url` ใน `services/enrichment-service.js` เป็น `https://this-domain-does-not-exist-12345.example`
- **Error ที่เกิดขึ้น:** `getaddrinfo ENOTFOUND this-domain-does-not-exist-12345.example`
- **Log จาก Terminal:**
  ```text
  [external-api] request to https://this-domain-does-not-exist-12345.example failed (attempt 1/2): getaddrinfo ENOTFOUND this-domain-does-not-exist-12345.example. Retrying in 620ms
  [external-api] request to https://this-domain-does-not-exist-12345.example failed (attempt 2/2): getaddrinfo ENOTFOUND this-domain-does-not-exist-12345.example. Retrying in 1661ms
  [enrichment-service] external API unavailable after retries: getaddrinfo ENOTFOUND this-domain-does-not-exist-12345.example
  GET /api/v1/students/1/enrichment 200 2354.672 ms - 294
  ```
- **Response ที่ได้รับ (HTTP Status 200):**
  ```json
  {
    "data": {
      "studentId": "1",
      "enrichment": {
        "source": "fallback",
        "available": false,
        "note": "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง"
      }
    }
  }
  ```

---

### สถานการณ์ที่ 2: Timeout

- **วิธีจำลอง:** แก้ไขพารามิเตอร์ `timeoutMs` ใน `services/enrichment-service.js` เป็น `fetchWithRetry(url, 1, 2)`
- **Error ที่เกิดขึ้น:** `timeout of 1ms exceeded` (Axios `ECONNABORTED`)
- **Log จาก Terminal:**
  ```text
  [external-api] request to https://jsonplaceholder.typicode.com/todos/1 failed (attempt 1/2): timeout of 1ms exceeded. Retrying in 605ms
  [external-api] request to https://jsonplaceholder.typicode.com/todos/1 failed (attempt 2/2): timeout of 1ms exceeded. Retrying in 1299ms
  [enrichment-service] external API unavailable after retries: timeout of 1ms exceeded
  GET /api/v1/students/1/enrichment 200 1946.994 ms - 294
  ```
- **Response ที่ได้รับ (HTTP Status 200):**
  ```json
  {
    "data": {
      "studentId": "1",
      "enrichment": {
        "source": "fallback",
        "available": false,
        "note": "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง"
      }
    }
  }
  ```

---

### สถานการณ์ที่ 3: External API คืน Error Status (500 Internal Server Error)

- **วิธีจำลอง:** รัน `node mock-fail-server.js` บนพอร์ต 4000 แล้วแก้ `url` ใน `services/enrichment-service.js` เป็น `http://localhost:4000`
- **Error ที่เกิดขึ้น:** `Request failed with status code 500`
- **Log จาก Terminal:**
  ```text
  [external-api] request to http://localhost:4000 failed (attempt 1/2): Request failed with status code 500. Retrying in 587ms
  [external-api] request to http://localhost:4000 failed (attempt 2/2): Request failed with status code 500. Retrying in 1992ms
  [enrichment-service] external API unavailable after retries: Request failed with status code 500
  GET /api/v1/students/1/enrichment 200 2604.343 ms - 294
  ```
- **Response ที่ได้รับ (HTTP Status 200):**
  ```json
  {
    "data": {
      "studentId": "1",
      "enrichment": {
        "source": "fallback",
        "available": false,
        "note": "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง"
      }
    }
  }
  ```

---

## การวิเคราะห์พฤติกรรมระบบตามจุดตรวจสอบที่ 3

1. **การแยกประเภท Error (`isRetryable`):**
   - Network error หรือ Timeout ไม่มี `error.response` ฟังก์ชันจึงคืน `true` เพื่อ retry
   - HTTP 500 เข้าเงื่อนไข `status >= 500 && status < 600` จึงคืน `true` เพื่อ retry
2. **Exponential Backoff พร้อม Equal Jitter:**
   - Attempt 1: Base delay คือ $2^0 \times 1000 = 1000\text{ ms}$ โดยมีช่วงสุ่ม Equal Jitter ระหว่าง 500ms ถึง 1000ms (ผลทดสอบจริงได้: 620ms, 605ms, 587ms)
   - Attempt 2: Base delay คือ $2^1 \times 1000 = 2000\text{ ms}$ โดยมีช่วงสุ่ม Equal Jitter ระหว่าง 1000ms ถึง 2000ms (ผลทดสอบจริงได้: 1661ms, 1299ms, 1992ms)
   - เวลาการ retry ไม่ตรงกันเป๊ะตามหลักการ Equal Jitter เพื่อป้องกันปัญหา Thundering Herd Problem
3. **Graceful Fallback:**
   - ทุกสถานการณ์ไม่เกิด server crash และไม่มี unhandled promise rejection
   - ฝั่งไคลเอนต์ได้รับ HTTP Status 200 เสมอ พร้อมโครงสร้าง `enrichment.source: "fallback"` และข้อความแจ้งเตือนที่เข้าใจง่าย
