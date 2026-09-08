# API Key disimpan sebagai plain text di V1

Memilih plain text daripada hashed storage (SHA-256/bcrypt) untuk API Key di V1, dengan alasan kemudahan debugging selama masa development internal. Migrasi ke hashed storage di V2 akan membutuhkan re-issue seluruh key ke semua Client.

## Considered Options

- **Plain text** *(dipilih)*: key langsung dibaca dari DB, tidak ada overhead transform.
- **SHA-256 hash**: proteksi terhadap DB breach tanpa slow-hash overhead; tidak dipilih karena meningkatkan kompleksitas V1.

## Consequences

Jika database bocor di V1, seluruh API Key semua Client langsung ter-expose. Risiko ini diterima secara sadar karena gateway bersifat internal dan diakses dari network yang terbatas. **Wajib dimigrasi ke SHA-256 sebelum gateway di-expose ke jaringan yang lebih luas.**
