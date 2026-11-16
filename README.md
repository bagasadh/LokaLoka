# Lokaloka

Aplikasi pencarian warung dan tempat makan di sekitar lokasi pengguna menggunakan OpenStreetMap dan Overpass API.

## Fitur
- Peta interaktif untuk mendeteksi warung sekitar secara langsung tanpa API key (OpenStreetMap + Overpass).
- Pencarian lokasi atau alamat untuk melihat warung di radius area tersebut.
- Halaman profil warung berisi detail tempat, jam buka, dan daftar menu beserta harga.
- Ulasan pengguna lengkap dengan rating bintang, foto, dan bukti nota/struk pembelian.
- Mode pemilik warung untuk mengelola daftar menu dan harga.
- Tampilan mobile-first (5.4"–6.9") dengan tema gelap (`#202020`, aksen putih), tetap bisa dibuka di desktop.

## Development

Pastikan Node.js (v18+) dan npm sudah terpasang.

```sh
# Install dependensi
npm install

# Jalankan server development
npm run dev

# Jalankan test
npm test

# Build untuk produksi
npm run build
```
