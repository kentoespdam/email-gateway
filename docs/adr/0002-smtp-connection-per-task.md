# SMTP connection dibuka dan ditutup per task (connection-per-task)

Memilih strategi connection-per-task untuk pengiriman SMTP daripada persistent global connection yang digunakan blueprint awal. Setiap Celery task membuka koneksi SMTP baru menggunakan context manager (`with smtplib.SMTP(...) as conn`), mengirim pesan, lalu menutupnya secara otomatis.

## Considered Options

- **Persistent global connection** *(ditolak)*: koneksi dibuka saat `worker_process_init` dan di-reuse. Berisiko karena AWS/GCP NAT Gateway dan SMTP server cloud (SES, Gmail) memutus idle TCP setelah 10–60 detik tanpa RST/FIN. Menggunakan `noop()` sebagai health-check tidak mengeliminasi race condition antara check dan pengiriman.
- **Connection-per-task** *(dipilih)*: nol risiko stale socket, immune terhadap idle timeout, graceful shutdown otomatis. Overhead handshake +300–800ms per email tidak relevan karena API sudah mengembalikan `202 Accepted` — user tidak menunggu.
- **Task batching**: cocok untuk >50 email/detik; over-engineering untuk volume internal gateway ini.

## Consequences

Jika volume gateway tumbuh melampaui ~10 email/detik, strategi ini perlu dievaluasi ulang ke task batching untuk menghindari auth rate-limit di provider SMTP.
