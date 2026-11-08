import warung1 from "@/assets/warung-1.jpg";
import nasgor from "@/assets/menu-nasgor.jpg";
import mieayam from "@/assets/menu-mieayam.jpg";
import esteh from "@/assets/menu-esteh.jpg";
import type { MenuItem, PriceSource, Review, Warung, WarungComment } from "./warung-data";

const m = (
  id: string,
  name: string,
  price: number,
  photo: string,
  category: MenuItem["category"],
  source: PriceSource,
  updatedMinAgo: number,
): MenuItem => ({ id, name, price, photo, category, source, updatedMinAgo });

export const WARUNGS: Warung[] = [
  {
    id: "bu-sri",
    name: "Warung Makan Bu Sri",
    category: "Nasi & lauk",
    lat: -6.2071,
    lng: 106.8441,
    address: "Jl. Kebon Sirih No. 12, Menteng",
    phone: "0812-3456-7890",
    open: "06:00",
    close: "22:00",
    cover: warung1,
    registered: true,
    hasQris: true,
    menu: [
      m("1", "Nasi Goreng Telur", 15000, nasgor, "makanan", "owner", 4),
      m("2", "Mie Ayam", 13000, mieayam, "makanan", "owner", 4),
      m("3", "Es Teh Manis", 4000, esteh, "minuman", "owner", 12),
    ],
  },
  {
    id: "mie-pak-joko",
    name: "Mie Ayam Pak Joko",
    category: "Mie",
    lat: -6.2102,
    lng: 106.8479,
    address: "Jl. Jaksa No. 5, Kebon Sirih",
    phone: "0813-1111-2222",
    open: "09:00",
    close: "21:00",
    cover: mieayam,
    registered: false,
    hasQris: true,
    menu: [
      m("1", "Mie Ayam Bakso", 17000, mieayam, "makanan", "google_places", 60 * 24 * 3),
      m("2", "Es Jeruk", 6000, esteh, "minuman", "other", 60 * 24 * 10),
    ],
  },
  {
    id: "nasgor-mas-dimas",
    name: "Nasi Goreng Mas Dimas",
    category: "Nasi goreng",
    lat: -6.2063,
    lng: 106.8489,
    address: "Jl. Wahid Hasyim No. 88",
    phone: "0857-2222-3333",
    open: "17:00",
    close: "02:00",
    cover: nasgor,
    registered: true,
    hasQris: false,
    menu: [
      m("1", "Nasi Goreng Spesial", 22000, nasgor, "makanan", "owner", 30),
      m("2", "Mie Goreng", 18000, mieayam, "makanan", "owner", 30),
      m("3", "Es Teh Tawar", 3000, esteh, "minuman", "owner", 90),
    ],
  },
  {
    id: "kopi-mbak-rini",
    name: "Warkop Mbak Rini",
    category: "Kopi & minuman",
    lat: -6.2115,
    lng: 106.8432,
    address: "Jl. Sabang No. 21",
    phone: "0821-4444-5555",
    open: "07:00",
    close: "23:00",
    cover: esteh,
    registered: false,
    hasQris: true,
    menu: [
      m("1", "Es Kopi Susu", 8000, esteh, "minuman", "google_places", 60 * 24 * 7),
      m("2", "Indomie Telur", 10000, mieayam, "makanan", "google_places", 60 * 24 * 7),
    ],
  },
];

export const SEED_REVIEWS: Review[] = [
  {
    id: "r1",
    warungId: "bu-sri",
    author: "Dinda",
    rating: 5,
    text: "Nasi gorengnya enak, porsinya banyak. Harga sesuai yang di aplikasi!",
    photos: [nasgor],
    receipt: "seed",
    createdAt: Date.UTC(2026, 10, 4),
  },
  {
    id: "r2",
    warungId: "bu-sri",
    author: "Raka",
    rating: 4,
    text: "Mie ayamnya mantap, tempat agak sempit kalau malam.",
    photos: [],
    receipt: "seed",
    createdAt: Date.UTC(2026, 10, 2),
  },
  {
    id: "r3",
    warungId: "nasgor-mas-dimas",
    author: "Putri",
    rating: 5,
    text: "Langganan tiap malam. Pedasnya pas.",
    photos: [nasgor],
    receipt: "seed",
    createdAt: Date.UTC(2026, 10, 1),
  },
];

export const SEED_COMMENTS: WarungComment[] = [
  {
    id: "c1",
    warungId: "bu-sri",
    author: "Dimas Anggara",
    createdAt: Date.now() - 4 * 3600 * 1000,
    text: "Patokan warungnya sebelah mana ya kak kalau dari arah stasiun? Parkir mobil bisa masuk ga?",
    replies: [
      {
        id: "rep-1",
        author: "Bu Sri (Pemilik)",
        isOwner: true,
        createdAt: Date.now() - 3 * 3600 * 1000,
        text: "Halo kak Dimas! Dari stasiun jalan lurus sekitar 100m, warung kami pas di samping minimarket cat kuning. Untuk mobil bisa parkir di seberang jalan kak 🙏",
      },
      {
        id: "rep-2",
        author: "Rian Fauzi",
        isOwner: false,
        createdAt: Date.now() - 2 * 3600 * 1000,
        text: "Bener bang, parkir motor luas banget pas di depan warung.",
      },
    ],
  },
  {
    id: "c2",
    warungId: "bu-sri",
    author: "Siti Rahma",
    createdAt: Date.now() - 24 * 3600 * 1000,
    text: "Menu nasi ramesnya kalau siang lauknya masih lengkap ga ya? Rekomendasi lauk paling mantap apa?",
    replies: [
      {
        id: "rep-3",
        author: "Fajar Nugraha",
        isOwner: false,
        createdAt: Date.now() - 22 * 3600 * 1000,
        text: "Jam 12 siang masih komplit banget kak. Wajib coba ayam goreng lengkuas sama tempe orek basahnya!",
      },
    ],
  },
  {
    id: "c3",
    warungId: "mie-ayam-pak-joko",
    author: "Bagus Tri",
    createdAt: Date.now() - 12 * 3600 * 1000,
    text: "Bisa bayar pakai QRIS ga min atau harus cash?",
    replies: [
      {
        id: "rep-4",
        author: "Pak Joko (Pemilik)",
        isOwner: true,
        createdAt: Date.now() - 11 * 3600 * 1000,
        text: "Sudah bisa QRIS semua bank & e-wallet kak, cash juga tetap diterima ya.",
      },
    ],
  },
];
