# Bun sebagai package manager dan runtime untuk frontend

Memilih Bun daripada npm atau pnpm sebagai package manager dan runtime untuk project frontend Dashboard. Bun menawarkan install time yang jauh lebih cepat (3–10x dibanding npm), built-in TypeScript support, dan kompatibilitas penuh dengan ekosistem npm. Untuk internal tool dengan tim kecil, keuntungan kecepatan dev loop sepadan dengan adopsi toolchain yang relatif baru.

## Considered Options

- **npm** *(ditolak)*: default Node.js, paling familiar, tapi paling lambat. Lock file (`package-lock.json`) lebih verbose.
- **pnpm** *(ditolak)*: lebih cepat dari npm, disk-efficient via content-addressable store. Dikenal stabil dan mature. Ditolak karena Bun sudah menyediakan keunggulan serupa dengan DX yang lebih terintegrasi.
- **Bun** *(dipilih)*: install tercepat, runtime JS built-in (bisa run scripts tanpa Node), kompatibel dengan Vite dan seluruh ekosistem npm. Cukup matang per 2025 untuk project internal.

## Consequences

Developer perlu install Bun (`curl -fsSL https://bun.sh/install | bash`). CI/CD pipeline memerlukan Bun image atau installer step. Jika ada edge case inkompatibilitas, fallback ke npm masih dimungkinkan karena `package.json` tetap standard.