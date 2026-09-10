# Proxy endpoint `/admin/emails/test-send` untuk Dashboard test page

Endpoint pengiriman email (`POST /api/v1/emails/send`) menggunakan autentikasi via header `X-API-Key`. Dashboard menggunakan AdminSession (HttpOnly cookie). Test Email Page di Dashboard perlu memanggil logika pengiriman email tanpa mengekspos raw `key_token` ke browser atau memaksa AdminUser untuk copy-paste token secara manual. Selain itu, test harus tetap realistis — termasuk validasi `from_address` whitelist.

## Considered Options

- **Frontend input manual API Key token** *(ditolak)*: AdminUser harus catat dan paste token ke form. UX buruk dan bertentangan dengan fakta bahwa token sudah bisa diambil dari DB (lihat ADR-0007).
- **Frontend pilih API Key dari dropdown, bypass semua validasi** *(ditolak)*: Test tidak realistis — whitelist `from_address` tidak diuji, sehingga bug konfigurasi bisa lolos tidak terdeteksi.
- **Proxy endpoint `/admin/emails/test-send` dengan AdminSession auth** *(dipilih)*: Backend menerima `api_key_id` + email payload, lookup API Key dari DB, jalankan validasi whitelist `from_address`, dispatch Celery task. AdminUser tidak perlu tahu raw token. Test end-to-end realistis karena validasi tetap berjalan.

## Consequences

Test Email Page dapat digunakan tanpa raw token. Validasi whitelist tetap dijalankan sehingga test mencerminkan pengalaman nyata Client Application. Endpoint baru perlu di-maintain dan dicakup oleh test.
