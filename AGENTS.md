# Lokaloka — Guidelines & Architecture

Project panduan dan catatan arsitektur untuk pengembangan aplikasi Lokaloka.

## Tech Stack
- **Framework:** TanStack Start (SSR/Full-stack React)
- **UI & Styling:** React 19, Tailwind CSS v4, Radix UI primitives, Lucide icons, Sonner
- **Peta & Lokasi:** Leaflet + OpenStreetMap (dengan styling kontras gelap / CARTO), Overpass API (deteksi tempat kuliner sekitar), Nominatim & Photon (geocoding/pencarian tempat)
- **State Management:** `@tanstack/react-store` (persisted di `localStorage`), `@tanstack/react-query`
- **Build & Test:** Vite, Vitest

## Perintah Kerja
- `npm run dev`: Jalankan server development
- `npm run build`: Build produksi
- `npm test`: Jalankan unit test dengan Vitest
- `npm run lint`: Cek linter dengan ESLint
