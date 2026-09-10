# `key_token` diekspos kembali via GET /admin/api-keys

Awalnya by-design, `key_token` hanya dikembalikan sekali saat API Key dibuat (`POST /admin/api-keys`) dan tidak pernah ditampilkan lagi. Namun `key_token` disimpan sebagai **plaintext** di kolom `api_keys.key_token` — keputusan "shown only once" adalah UI policy, bukan enkripsi. Ketika client kehilangan token, AdminUser tidak bisa membantu tanpa akses langsung ke database. Untuk internal tool dengan scope terbatas (hanya AdminUser yang bisa akses Dashboard), policy keamanan diserahkan ke user app.

## Considered Options

- **Pertahankan "shown only once"** *(ditolak)*: Memaksa client yang kehilangan token untuk membuat API Key baru dan reconfigure sistem mereka. Aman secara teori tapi mahal dari sisi operasional.
- **Hash token di DB (bcrypt/argon2)** *(ditolak)*: Solusi keamanan yang proper, tapi breaking change besar — autentikasi saat ini membandingkan raw string, harus diubah ke verify-hash. Tidak sebanding untuk internal tool.
- **Expose `key_token` di GET response, tampilkan masked + eye toggle di FE** *(dipilih)*: Memanfaatkan fakta bahwa token sudah plaintext di DB. FE menambahkan UX friction (masked by default) untuk mengurangi eksposur tidak sengaja. Tanggung jawab keamanan diserahkan ke AdminUser.

## Consequences

AdminUser dapat membantu client yang kehilangan token tanpa akses database langsung. Tradeoff: jika AdminSession dikompromikan, seluruh token API Key dapat dibaca. Ini diterima karena scope Dashboard terbatas ke tim internal.
