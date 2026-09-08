# PostgreSQL sebagai database penyimpanan API Keys dan Mail Transactions

Memilih PostgreSQL daripada SQLite untuk menyimpan API Keys dan Mail Transactions. Gateway berfungsi sebagai shared internal infrastructure yang berpotensi diakses oleh multiple service instance (horizontal scaling), sehingga membutuhkan database yang aman untuk concurrent writes.

## Considered Options

- **SQLite** *(ditolak)*: zero infra tambahan, cocok untuk single-instance. Ditolak karena lock contention pada multiple concurrent Celery worker writes dan tidak aman untuk horizontal scaling.
- **PostgreSQL** *(dipilih)*: production-grade, aman untuk multi-instance, sudah lazim di stack FastAPI. Ditambahkan sebagai service di docker-compose dengan overhead konfigurasi minimal.

## Consequences

Stack deployment bertambah satu container (PostgreSQL). Migration dari SQLite tidak diperlukan karena keputusan ini diambil sebelum implementasi dimulai.
