# DB-stored UUID token untuk AdminSession, bukan JWT

Memilih random UUID token yang disimpan di tabel `admin_sessions` (PostgreSQL) sebagai mekanisme sesi AdminUser, bukan JWT stateless. JWT tidak bisa di-revoke tanpa infrastruktur blocklist tambahan — jika admin logout atau session dicabut, token lama tetap valid hingga expired. DB token langsung tidak valid begitu baris dihapus, memberikan revokasi instan saat logout.

## Considered Options

- **JWT (stateless)** *(ditolak)*: tidak butuh DB lookup per request, ecosystem luas. Ditolak karena tidak bisa di-revoke tanpa Redis blocklist, dan proyek sudah memilih untuk tidak menambah Redis (lihat ADR-0002 konteks SMTP, PostgreSQL sudah tersedia).
- **DB-stored UUID token** *(dipilih)*: satu DB lookup per request via `admin_sessions`, tapi revokasi instan saat logout. Tidak menambah dependency baru — PostgreSQL sudah ada. Cocok untuk internal tool dengan <10 concurrent admin user.

## Consequences

Setiap authenticated request Dashboard melakukan satu tambahan query ke tabel `admin_sessions`. Sliding window 24 jam di-implementasi dengan update kolom `last_seen_at` per request aktif.
