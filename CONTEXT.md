# Email Gateway

Microservice tunggal yang menerima permintaan pengiriman email dari aplikasi internal via REST API, mengantrekannya ke Redis, dan mengirimkannya ke server SMTP melalui Celery worker.

## Language

### Identitas & Akses

**API Key**:
Token statis yang digunakan aplikasi klien untuk mengotentikasi diri ke gateway. Disimpan di database. Setiap API Key memiliki daftar `allowed_from_addresses` — `from_address` di luar daftar ini ditolak dengan HTTP 403.
_Avoid_: token, secret, credential

**Client Application** (atau singkatnya **Client**):
Aplikasi internal (billing, HRIS, training portal) yang mengirim permintaan email ke gateway. Satu client memiliki satu API Key.
_Avoid_: consumer, caller, service, pengguna

### Pengiriman Email

**Email Request**:
Payload JSON yang dikirim oleh Client ke `POST /api/v1/emails/send`. Berisi penerima, subjek, konten, dan lampiran. Response mengembalikan `task_id` yang bisa di-query via `GET /api/v1/emails/{task_id}` untuk memeriksa Delivery Status.
_Avoid_: message, email payload, request body

**From Address**:
Alamat email pengirim yang disertakan dalam Email Request. Setiap Client boleh menentukan sender address berbeda (misal `billing@domain.com`).
_Avoid_: sender, from email, reply-to

**Attachment**:
File biner yang dilampirkan dalam Email Request, direpresentasikan sebagai string Base64 dengan metadata `filename` dan `content_type`.
_Avoid_: file, lampiran (dalam kode)

**Task**:
Unit kerja Celery yang dibuat untuk setiap Email Request yang diterima. Satu Task mengeksekusi satu pengiriman SMTP.
_Avoid_: job, worker task, background job


### Audit & Monitoring

**Mail Transaction**:
Rekaman permanen dari setiap Email Request yang diproses gateway. Field: `client_id`, `task_id`, `to_addresses`, `cc_addresses`, `subject`, `from_address`, `attachment_count`, `status`, `error_message`, `retry_count`, `created_at`, `delivered_at`. Konten email dan data biner attachment **tidak** disimpan.
_Avoid_: log entry, email log, audit record

**Delivery Status**:
Status akhir dari satu Mail Transaction: `queued`, `sent`, atau `failed`.
- `failed` bisa berasal dari: (a) transient error setelah 3x retry habis, atau (b) permanent SMTP error (kode `552 5.3.4`) yang langsung tidak di-retry.
_Avoid_: state, result, status email

### Administrasi & Dashboard

**Dashboard**:
Antarmuka web internal (React SPA) untuk mengelola API Key, memantau Mail Transaction, dan mengelola AdminUser. Hanya bisa diakses oleh AdminUser.
_Avoid_: admin panel, backoffice, UI

**AdminUser**:
Anggota tim internal yang mengelola gateway via Dashboard. Dibuat oleh AdminUser lain, atau di-bootstrap dari env var saat startup. Memiliki akses penuh ke semua fitur Dashboard.
_Avoid_: user, operator, staff

**AdminSession**:
Kredensial sementara berupa UUID token yang disimpan di tabel `admin_sessions`, diterbitkan kepada AdminUser setelah login berhasil. Berlaku 24 jam sejak request terakhir (sliding window). Dikirim ke browser sebagai HttpOnly cookie.
_Avoid_: token, JWT, session token

