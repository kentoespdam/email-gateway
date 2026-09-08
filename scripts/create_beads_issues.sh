#!/usr/bin/env bash
set -e

echo "==> Mendaftarkan 7 Beads Issues ke database internal..."

bd create "Konfigurasi Lingkungan, Toolchain uv, Dependensi, dan Observabilitas" \
  -t task -p 1 -l ready-for-agent \
  -d "Menyiapkan fondasi proyek meliputi struktur repositori, manajemen paket Python menggunakan uv pada pyproject.toml, konfigurasi variabel lingkungan, logging terstruktur dengan structlog, dan orkestrasi container Docker Compose.

Ruang Lingkup:
1. Konfigurasi pyproject.toml menggunakan uv dengan dependensi utama: fastapi, uvicorn[standard], pydantic[email], pydantic-settings, sqlalchemy, psycopg2-binary, alembic, celery[redis], redis, dan structlog. Dependensi dev: pytest, httpx, pytest-mock.
2. Template .env.example untuk kredensial Redis, PostgreSQL, SMTP, dan konfigurasi app.
3. Modul logging terstruktur structlog (JSON untuk produksi, konsol untuk dev).
4. docker-compose.yml untuk PostgreSQL 16 dan Redis 7.

Kriteria Penerimaan:
- uv sync berhasil tanpa konflik.
- Seluruh variabel lingkungan termuat dengan aman.
- Layanan Redis dan PostgreSQL pada Docker Compose dapat dihubungkan."

bd create "Model Database Relasional (SQLAlchemy) & Skema Migrasi (Alembic)" \
  -t task -p 1 -l ready-for-agent \
  -d "Membangun lapisan database relasional synchronous menggunakan SQLAlchemy dan PostgreSQL untuk menyimpan data autentikasi klien dan pencatatan riwayat transaksi pengiriman email (audit trail).

Ruang Lingkup:
1. Modul koneksi database synchronous (engine dan SessionLocal) berbasis PostgreSQL.
2. Model ApiKey: UUID, token kunci unik, nama klien, allowed_from_addresses (array string), status aktif, timestamp.
3. Model MailTransaction: UUID, task_id unik, client_id, from_address, to_addresses, cc_addresses, subject, attachment_count, status (queued, sent, failed), error_message, retry_count, created_at, delivered_at. (Tanpa konten email & data biner attachment).
4. Konfigurasi Alembic dan berkas migrasi revisi pertama untuk seluruh tabel dan indeks.

Kriteria Penerimaan:
- Model tabel terdefinisi lengkap dengan batasan integritas.
- Migrasi Alembic (upgrade/downgrade) berjalan sukses."

bd create "Skema Validasi Kontrak Data (Pydantic V2) & Batasan Ukuran Payload" \
  -t task -p 2 -l ready-for-agent \
  -d "Menyusun skema validasi data request dan response API menggunakan Pydantic V2 dengan penegakan aturan integritas data dan batasan ukuran payload.

Ruang Lingkup:
1. Skema Attachment: filename, MIME content_type, base64_data.
2. Skema EmailPayload: to (wajib), cc (opsional), from_address (wajib), subject (wajib), text_content, html_content, attachments.
3. Validator konten: wajib minimal salah satu dari text_content atau html_content terisi.
4. Validator ukuran: estimasi ukuran biner dari Base64 tidak melampaui batas 15 MB (estimasi berkas mentah ~10.5 MB).
5. Skema response untuk penerimaan request (HTTP 202 Accepted) dan pelacakan status transaksi (HTTP 200 OK).

Kriteria Penerimaan:
- Payload valid berhasil divalidasi.
- Payload malformed, tanpa body, atau melebihi 15 MB ditolak secara presisi."

bd create "Lapisan Keamanan, Autentikasi Klien (X-API-Key), & Otorisasi Alamat Pengirim" \
  -t task -p 2 -l ready-for-agent \
  -d "Mengembangkan mekanisme keamanan endpoint berbasis dependency injection FastAPI untuk autentikasi kunci API klien dan otorisasi penggunaan alamat email pengirim.

Ruang Lingkup:
1. Dependency keamanan untuk membaca header X-API-Key.
2. Verifikasi kunci API terhadap tabel api_keys di database (status aktif). Mengembalikan HTTP 401 jika tidak valid/tidak aktif.
3. Otorisasi pengirim: from_address pada payload wajib terdaftar di allowed_from_addresses milik klien. Mengembalikan HTTP 403 jika di luar hak akses.
4. Logging terstruktur untuk setiap percobaan autentikasi yang gagal.

Kriteria Penerimaan:
- Request tanpa/salah API key ditolak dengan HTTP 401.
- Request dengan sender tidak terdaftar ditolak dengan HTTP 403.
- Request terotorisasi lolos ke tahap pemrosesan."

bd create "Worker Asinkron (Celery) & Mesin Pengiriman SMTP (Connection-per-Task)" \
  -t task -p 3 -l ready-for-agent \
  -d "Membangun layanan background worker menggunakan Celery dan Redis untuk mengeksekusi pengiriman email melalui protokol SMTP dengan strategi koneksi per-task, isolasi kegagalan, dan mekanisme retry terukur.

Ruang Lingkup:
1. Konfigurasi Celery dengan Redis broker dan JSON serializer.
2. Task pengiriman email pola connection-per-task (context manager): buka koneksi SMTP dengan timeout 15 detik, STARTTLS, autentikasi, rakit email MIME multipart + attachment decoding Base64, kirim, dan tutup otomatis.
3. Pembaruan status transaksi: ubah status MailTransaction menjadi sent dan catat delivered_at saat sukses.
4. Error handling & retry:
   - Respon permanen SMTP 552: ubah status ke failed tanpa retry.
   - Gangguan sementara (Timeout/Connection Refused): retry maksimal 3x dengan skema jeda [60s, 300s, 900s]. Perbarui retry_count di database.
5. Structured logging (structlog) pada setiap tahap proses.

Kriteria Penerimaan:
- Task berhasil mengirim email via SMTP dan mencatat status sent.
- Kesalahan 552 tidak memicu retry dan langsung berstatus failed.
- Gangguan sementara memicu retry sesuai jadwal jeda."

bd create "Implementasi REST API Routing (Pengiriman Email & Pelacakan Status)" \
  -t task -p 3 -l ready-for-agent \
  -d "Mengembangkan router dan endpoint API FastAPI untuk melayani permintaan pengiriman email asinkron dan pengecekan status transaksi pengiriman.

Ruang Lingkup:
1. Endpoint POST /api/v1/emails/send:
   - Validasi autentikasi API key dan otorisasi from_address.
   - Buat rekaman MailTransaction berstatus queued.
   - Kirim task ke antrean Celery secara asinkron dengan task_id unik.
   - Kembalikan respons HTTP 202 Accepted beserta task_id (<100ms).
2. Endpoint GET /api/v1/emails/{task_id}:
   - Validasi autentikasi API key.
   - Ambil data transaksi berdasarkan task_id milik klien pemanggil (isolasi data antar klien).
   - Kembalikan HTTP 404 jika tidak ditemukan/bukan milik klien.
   - Kembalikan status (queued, sent, failed), retry_count, error_message, timestamp jika ditemukan.
3. Dokumentasi interaktif OpenAPI/Swagger otomatis.

Kriteria Penerimaan:
- POST /send merespons cepat (<100ms) dengan HTTP 202 dan task_id.
- Data transaksi tersimpan sebelum task masuk antrean.
- GET /{task_id} mengembalikan status akurat dan menolak akses lintas klien."

bd create "Pengujian Terotomatisasi (Pytest) & Verifikasi Kualitas Keseluruhan" \
  -t task -p 4 -l ready-for-agent \
  -d "Menyusun rangkaian pengujian terotomatisasi komprehensif menggunakan Pytest untuk memastikan keandalan seluruh komponen sistem gateway email.

Ruang Lingkup:
1. Unit tests: validasi skema Pydantic, pembatasan ukuran payload 15 MB, validasi body teks/HTML.
2. Integration tests: endpoint FastAPI, penolakan HTTP 401 dan 403, penerimaan HTTP 202, query HTTP 200, penolakan HTTP 404.
3. Mock tests: task worker Celery dan SMTP (sukses, kegagalan permanen 552, retry bertingkat).
4. Verifikasi baris kode file (<300 LOC) dan kualitas gate.

Kriteria Penerimaan:
- Seluruh unit, integration, dan mock test lulus via uv run pytest.
- Quality gates terpenuhi 100%."

chmod +x /mnt/DATA/python/email-gateway/scripts/create_beads_issues.sh
echo ""
echo "==> Selesai membuat issues. Menampilkan daftar issues:"
bd list
