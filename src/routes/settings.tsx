import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Compass,
  Info,
  LocateFixed,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { locate } from "@/lib/geo";
import { clearRecentSearches } from "@/lib/search-history";
import { actions, useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan — Lokaloka" },
      {
        name: "description",
        content:
          "Atur izin lokasi GPS, tema warna peta (hitam/putih), dan preferensi tampilan Lokaloka.",
      },
      { property: "og:title", content: "Pengaturan — Lokaloka" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useStore();
  const [testingGps, setTestingGps] = useState(false);
  const [pinStyle, setPinStyle] = useState<"badge" | "compact">("badge");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lokaloka_pin_style");
      if (saved === "badge" || saved === "compact") {
        setPinStyle(saved);
      }
    } catch {
      // Abaikan
    }
  }, []);

  const locationEnabled = s.settings?.locationEnabled ?? true;
  const mapTheme = s.settings?.mapTheme ?? "dark";

  const handleToggleLocation = () => {
    const next = actions.toggleLocationEnabled();
    if (next) {
      toast.success("Izin lokasi GPS diaktifkan");
      void locate({ force: true });
    } else {
      toast.info("Izin lokasi dinonaktifkan. Mode penjelajahan manual aktif.");
    }
  };

  const handleSetTheme = (theme: "dark" | "light") => {
    actions.setMapTheme(theme);
    toast.success(
      theme === "dark"
        ? "Tema peta diubah ke Versi Hitam (Gelap)"
        : "Tema peta diubah ke Versi Putih (Terang)",
    );
  };

  const handleSetPinStyle = (style: "badge" | "compact") => {
    setPinStyle(style);
    try {
      localStorage.setItem("lokaloka_pin_style", style);
    } catch {
      // Abaikan
    }
    toast.success(
      style === "badge" ? "Penanda: Harga & menu termurah" : "Penanda: Pin ringkas minimalis",
    );
  };

  const handleClearHistory = () => {
    clearRecentSearches();
    toast.success("Riwayat pencarian warung dan tempat berhasil dibersihkan");
  };

  const handleTestGps = async () => {
    setTestingGps(true);
    try {
      const res = await locate({ force: true, timeoutMs: 8000 });
      if (res.real) {
        toast.success(
          `Lokasi GPS terdeteksi (${res.loc.lat.toFixed(4)}, ${res.loc.lng.toFixed(4)})`,
        );
      } else {
        toast.warning("GPS tidak dapat membaca koordinat perangkat. Menggunakan titik default.");
      }
    } catch {
      toast.error("Gagal memperbarui posisi GPS.");
    } finally {
      setTestingGps(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pt-safe pb-28 lg:pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-3 pb-4">
        <Link
          to="/"
          aria-label="Kembali ke Peta"
          className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm transition hover:bg-card/80 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg font-bold">Settings & Preferensi</h1>
        <Link
          to="/profil"
          aria-label="Ke Profil"
          className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm transition hover:bg-card/80 active:scale-95"
        >
          <User className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Seksi 1: Izin Lokasi */}
        <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                  locationEnabled
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                <LocateFixed className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-foreground">
                  Izin Akses Lokasi (GPS)
                </p>
                <p className="text-xs text-muted-foreground">
                  {locationEnabled
                    ? "GPS aktif mendeteksi warung di radius posisimu."
                    : "GPS nonaktif. Mode penjelajahan manual di peta."}
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={locationEnabled}
              onClick={handleToggleLocation}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                locationEnabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  locationEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {locationEnabled && (
            <div className="mt-3.5 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={handleTestGps}
                disabled={testingGps}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-xs font-semibold text-foreground transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testingGps ? "animate-spin" : ""}`} />
                <span>{testingGps ? "Membaca GPS..." : "Perbarui & Uji Titik GPS Sekarang"}</span>
              </button>
            </div>
          )}
        </section>

        {/* Seksi 2: Tema Warna Peta (Hitam / Putih) */}
        <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-1">
            <Compass className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-sm font-bold text-foreground">Warna Tema Peta</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Sesuaikan skema warna tampilan peta OpenStreetMap:
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {/* Opsi Hitam (Dark) */}
            <button
              type="button"
              onClick={() => handleSetTheme("dark")}
              className={`flex flex-col rounded-2xl border p-3 text-left transition-all active:scale-95 ${
                mapTheme === "dark"
                  ? "border-amber-500/50 bg-amber-500/10 shadow-xs"
                  : "border-white/5 bg-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#1c1c1c] text-amber-300 border border-white/10">
                  <Moon className="h-4 w-4" />
                </span>
                {mapTheme === "dark" && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
              </div>
              <p className="mt-2.5 font-display text-xs font-bold text-foreground">Versi Hitam</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                Kontras gelap, hemat baterai, nyaman malam hari
              </p>
            </button>

            {/* Opsi Putih (Light) */}
            <button
              type="button"
              onClick={() => handleSetTheme("light")}
              className={`flex flex-col rounded-2xl border p-3 text-left transition-all active:scale-95 ${
                mapTheme === "light"
                  ? "border-amber-500/50 bg-amber-500/10 shadow-xs"
                  : "border-white/5 bg-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-200 text-amber-600 border border-slate-300">
                  <Sun className="h-4 w-4" />
                </span>
                {mapTheme === "light" && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
              </div>
              <p className="mt-2.5 font-display text-xs font-bold text-foreground">Versi Putih</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                Peta terang klasik, bersih & jelas di siang hari
              </p>
            </button>
          </div>
        </section>

        {/* Seksi 3: Gaya Penanda Warung */}
        <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Gaya Penanda di Peta</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Pilih bagaimana warung ditampilkan di layar peta:
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSetPinStyle("badge")}
              className={`rounded-2xl border p-3 text-left transition-all active:scale-95 ${
                pinStyle === "badge"
                  ? "border-primary/50 bg-primary/10 shadow-xs"
                  : "border-white/5 bg-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">🍜</span>
                {pinStyle === "badge" && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="mt-2 font-display text-xs font-bold text-foreground">Harga & Menu</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Label harga termurah & ikon makanan
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSetPinStyle("compact")}
              className={`rounded-2xl border p-3 text-left transition-all active:scale-95 ${
                pinStyle === "compact"
                  ? "border-primary/50 bg-primary/10 shadow-xs"
                  : "border-white/5 bg-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">📍</span>
                {pinStyle === "compact" && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="mt-2 font-display text-xs font-bold text-foreground">Pin Ringkas</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Pin bulat bersih tanpa gambar makanan
              </p>
            </button>
          </div>
        </section>

        {/* Seksi 4: Akses Cepat Profil */}
        <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-foreground">
                  Profil & Riwayat Ulasan
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.user ? `Login sebagai ${s.user.name}` : "Masuk untuk menulis ulasan berstruk"}
                </p>
              </div>
            </div>
            <Link
              to="/profil"
              className="inline-flex h-9 items-center rounded-xl bg-white/10 px-3 text-xs font-semibold text-foreground transition hover:bg-white/15 active:scale-95"
            >
              Buka Profil
            </Link>
          </div>
        </section>

        {/* Seksi 5: Data & Privasi */}
        <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <p className="font-display text-sm font-bold text-foreground">Data Pencarian</p>
          <p className="text-xs text-muted-foreground">
            Bersihkan riwayat kata kunci pencarian yang tersimpan di perangkat ini.
          </p>

          <button
            type="button"
            onClick={handleClearHistory}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive transition hover:bg-destructive/20 active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Riwayat Pencarian</span>
          </button>
        </section>

        {/* Seksi 6: Tentang Aplikasi */}
        <div className="flex items-center justify-center gap-1.5 py-4 text-center text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Lokaloka v1.2 · OpenStreetMap & CARTO Dark/Light</span>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
