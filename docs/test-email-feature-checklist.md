# Test Email Feature — Implementation Checklist

Dua fitur baru berdasarkan sesi desain grilling (2026-09-10).
Rujuk ADR: `docs/adr/0007-expose-api-key-token-in-get-response.md` dan `docs/adr/0008-admin-proxy-endpoint-for-test-email.md`

## Urutan Pengerjaan (Dependency Order)

### Phase 1 — Backend (paralel)
- [ ] email-gateway-mzh — [BE] Expose `key_token` in GET /admin/api-keys response
- [ ] email-gateway-4an — [BE] Add POST /admin/emails/test-send proxy endpoint

### Phase 2 — Frontend Setup (setelah Phase 1)
- [ ] email-gateway-u9v — [FE] Install @tinymce/tinymce-react dependency

### Phase 3 — Frontend Feature: API Keys Page (setelah Issue 1)
- [ ] email-gateway-3qe — [FE] API Keys page: masked key_token + eye toggle + copy

### Phase 4 — Frontend Feature: Test Email Page (setelah Issue 3 & 4)
- [ ] email-gateway-289 — [FE] Test Email page — form
- [ ] email-gateway-o8m — [FE] Test Email page — result panel + auto-poll

## Keputusan Desain

| Keputusan | Pilihan |
|-----------|--------|
| Auth test page | Proxy `/admin/emails/test-send` (AdminSession) |
| Validasi whitelist | Tetap dijalankan via selected API Key |
| Konten email | Toggle Text/HTML, HTML pakai TinyMCE CDN |
| Attachment | Upload → base64 FE, warn 10MB, block 15MB |
| Status feedback | Auto-poll TanStack Query `refetchInterval: 2000` |
| Navigasi | Sidebar `MailOutlined` `/test-email` |
| From address | Dropdown `allowed_from_addresses` + opsi custom |
| Layout | Top-bottom: form atas, result panel bawah |
| Result panel | Status badge + summary Mail Transaction lengkap |
| key_token visibility | Masked + eye toggle + copy (ADR-0007) |
