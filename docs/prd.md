**Product Requirements Document (PRD): Centralized Email Gateway API**

**Dokumen:** Versi 1.0
**Pemilik Proyek:** Bagus Sudrajat (Kent Os)
**Tanggal:** September 2026

---

## 1. Ringkasan Eksekutif

Aplikasi *Email Gateway* adalah *microservice* berbasis REST API yang berfungsi sebagai agen tunggal pengiriman email untuk seluruh aplikasi internal (seperti sistem *billing*, HRIS, portal *training*). Sistem ini memisahkan beban kerja SMTP yang lambat dari aplikasi *client*, mencegah *timeout*, dan menghilangkan kebutuhan *setup* kredensial SMTP yang berulang di setiap aplikasi.

## 2. Arsitektur & Teknologi

Sistem ini menggunakan arsitektur *asynchronous* berbasis *task queue*.

* **Web Framework:** FastAPI (untuk penerimaan HTTP *request* dan validasi *payload* otomatis via Pydantic).
* **Message Broker:** Redis (menyimpan antrean pesan secara *in-memory* dengan persistensi).
* **Worker Engine:** Celery (menarik antrean dari Redis dan mengeksekusi pengiriman).
* **Protokol:** SMTP dengan manajemen *Persistent Connection Pooling* di sisi *worker*.

## 3. Spesifikasi Fitur (Functional Requirements)

* **Autentikasi Klien:** API harus memvalidasi keberadaan dan keabsahan *header* `X-API-Key` sebelum memproses *request*. Kunci yang tidak valid akan langsung mengembalikan HTTP 401 Unauthorized.
* **Validasi Payload:** Sistem harus memvalidasi struktur JSON secara ketat. Jika alamat email *malformed* atau *field* wajib kosong, API akan mengembalikan HTTP 422 Unprocessable Entity.
* **Queuing & Background Processing:** API selalu mengembalikan HTTP 202 Accepted sesegera mungkin setelah menaruh *payload* ke Redis, tanpa menunggu email benar-benar terkirim oleh SMTP.
* **Fleksibilitas Konten:** Sistem harus mampu merender format `text/plain`, `text/html`, dan membaca *array* dari objek *file* yang di-enkode menggunakan Base64.
* **Automatic Retry:** Celery *worker* harus dikonfigurasi untuk melakukan *retry* dengan skema *exponential backoff* (misal: jeda 1 menit, 5 menit, 15 menit) jika *server* SMTP tujuan mengalami *timeout* atau gangguan koneksi (*connection refused*).

## 4. Kinerja & Keamanan (Non-Functional Requirements)

| Kategori | Spesifikasi |
| --- | --- |
| **Kinerja (Throughput)** | *Worker* harus mempertahankan koneksi SMTP (*persistent connection*) selama siklus hidupnya atau *batch processing* untuk menghilangkan latensi *handshake* berulang saat *blast* massal. |
| **Batas Ukuran (Rate Limit/Size)** | Maksimal ukuran *payload* per *request* dibatasi 15 MB (untuk mengakomodasi ekspansi ukuran dari konversi PDF ke Base64). |
| **Isolasi Kegagalan** | Matinya satu *worker* Celery atau gagalnya *server* SMTP tidak boleh menyebabkan aplikasi *client* *error*. Pesan tetap aman di dalam Redis. |

## 5. Desain Kontrak API

**Endpoint:** `POST /api/v1/emails/send`
**Headers:**

* `Content-Type: application/json`
* `X-API-Key: <static-client-key>`

**Struktur Payload (JSON):**

```json
{
  "to": ["user@domain.com", "finance@domain.com"],
  "cc": ["manager@domain.com"], 
  "subject": "Invoice Tagihan Internet - September 2026",
  "text_content": "Berikut adalah tagihan Anda...",
  "html_content": "<strong>Berikut adalah tagihan Anda...</strong>",
  "attachments": [
    {
      "filename": "invoice_september.pdf",
      "content_type": "application/pdf",
      "base64_data": "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVu..."
    }
  ]
}

```

*(Catatan: `text_content` dan `html_content` bersifat opsional, tetapi minimal salah satu harus ada).*

## 6. Out of Scope (Di Luar Cakupan Rilis V1)

* Pembuatan GUI/Dashboard Web untuk admin (semua manajemen API Key V1 dilakukan via *environment variables* atau modifikasi *database* langsung).
* Fitur *tracking* buka/klik (*Open/Click Tracking*) menggunakan *tracking pixel*.
* *Template engine* internal (Jinja2) di sisi *gateway*.