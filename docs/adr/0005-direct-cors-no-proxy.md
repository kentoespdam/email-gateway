# Dashboard FE memanggil BE secara langsung via CORS, tanpa nginx reverse proxy

Dashboard (React SPA) berkomunikasi dengan FastAPI BE di port berbeda menggunakan CORS, bukan melalui nginx reverse proxy sebagai single entry point. Nginx proxy lebih production-ready dan menghilangkan konfigurasi CORS sama sekali, namun menambah satu container dan konfigurasi nginx. Untuk internal tool dengan satu deployment target dan tim kecil, CORS via env var `ALLOWED_ORIGINS` lebih simpel tanpa pengorbanan keamanan yang berarti.

## Considered Options

- **Nginx reverse proxy** *(ditolak)*: satu entry point (port 80), tidak ada CORS, cookie bekerja sempurna di same-origin. Ditolak karena menambah container nginx dan file konfigurasi yang harus di-maintain, overhead yang tidak sepadan untuk internal tool.
- **Direct CORS calls** *(dipilih)*: FE di port terpisah memanggil BE langsung. CORS dikonfigurasi via env var `ALLOWED_ORIGINS` di FastAPI. Cookie menggunakan `SameSite=Lax` yang kompatibel selama FE dan BE berada di registered domain yang sama saat deployment.

## Consequences

FastAPI harus dikonfigurasi dengan `CORSMiddleware` dan `allow_credentials=True`. Origin yang diizinkan wajib diset eksplisit via `ALLOWED_ORIGINS` — wildcard `*` tidak kompatibel dengan `allow_credentials=True` di browser.
