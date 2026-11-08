import {
  AlertTriangle,
  Info,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  X,
} from "lucide-react";
import type { WarungPriceRadar } from "@/lib/price-radar";
import { formatRupiah } from "@/lib/warung-data";

export function PriceRadarCard({
  radar,
  onOpenInfo,
}: {
  radar: WarungPriceRadar;
  onOpenInfo: () => void;
}) {
  const isCheap = radar.tier === "cheap";
  const isFair = radar.tier === "fair";
  const isHigh = radar.tier === "high";
  const isOverpriced = radar.tier === "overpriced";

  const cardStyle = isOverpriced
    ? "border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-card to-card"
    : isHigh
      ? "border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-card to-card"
      : isCheap
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-card to-card"
        : "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card";

  const badgeStyle = isOverpriced
    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
    : isHigh
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : isCheap
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
        : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className={`mt-4 rounded-3xl border p-4 shadow-sm transition-all ${cardStyle}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}
            >
              {isOverpriced ? (
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              ) : isHigh ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              ) : isCheap ? (
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              {radar.title}
            </span>
            {radar.hasVerifiedReceipts && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                <Receipt className="h-3 w-3" />
                Struk Terverifikasi
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {radar.description}
          </p>
        </div>
        <button
          type="button"
          aria-label="Pelajari Radar Anti-Getok"
          onClick={onOpenInfo}
          className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95"
        >
          <Info className="h-3.5 w-3.5" />
          <span>Info</span>
        </button>
      </div>

      {radar.averagePrice > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Rata-rata: {formatRupiah(radar.averagePrice)}
          </span>
          <span>·</span>
          <span>{radar.analyzedCount} menu terdaftar</span>
          {radar.hasVerifiedReceipts && (
            <>
              <span>·</span>
              <span className="text-sky-300">{radar.receiptCount} bukti struk</span>
            </>
          )}
        </div>
      )}

      {isOverpriced && (
        <div className="mt-3 rounded-2xl bg-rose-500/10 p-2.5 text-xs text-rose-200">
          <p className="font-semibold">⚠️ Tips Hindari Getok Harga:</p>
          <p className="mt-0.5 text-[11px] text-rose-200/90">
            Tanyakan harga pasti sebelum memesan atau minta nota rincian untuk mencegah markup tak
            wajar.
          </p>
        </div>
      )}
    </div>
  );
}

export function RadarInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Penjelasan Radar Anti-Getok Harga"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:p-4 sm:items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-card p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Radar Anti-Getok Harga</h2>
              <p className="text-[11px] text-muted-foreground">
                Perlindungan pembeli & keterbukaan harga
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup penjelasan radar"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Fitur <strong className="text-foreground">Radar Anti-Getok</strong> dirancang khusus
            oleh Lokaloka untuk melindungi pembeli, mahasiswa, perantau, dan wisatawan dari praktik
            kenaikan harga sepihak atau ketiadaan daftar menu resmi.
          </p>

          <div className="rounded-2xl border border-white/5 bg-muted/50 p-3.5 space-y-2">
            <p className="font-semibold text-foreground">3 Sumber Penilaian:</p>
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                <strong className="text-foreground">Indeks Harga Standar:</strong> Acuan harga
                rata-rata hidangan kuliner rakyat di area sekitar.
              </li>
              <li>
                <strong className="text-foreground">Komparasi Tetangga:</strong> Perbandingan
                real-time dengan menu sejenis di warung radius terdekat.
              </li>
              <li>
                <strong className="text-foreground">Verifikasi Struk Nyata:</strong> Setiap ulasan
                yang menyertakan foto struk pembeli langsung memvalidasi keaslian harga.
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-foreground">Level Kewajaran Harga:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300">
                <span className="text-base leading-none">🟢</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Sangat Ramah Kantong (&le; -15%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Harga lebih hemat dari pasaran umum, sangat ramah budget pelajar/harian.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-primary/10 p-2.5 text-primary">
                <span className="text-base leading-none">🟢</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Harga Wajar Pasaran (-15% s/d +15%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sesuai dengan standar harga pedagang makanan di kawasan setempat.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-amber-300">
                <span className="text-base leading-none">🟡</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Sedikit di Atas Rata-rata (+16% s/d +39%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sedikit lebih mahal (umumnya karena porsi lebih besar atau fasilitas tempat
                    dine-in).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-2.5 text-rose-300">
                <span className="text-base leading-none">🔴</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Waspada Potensi Getok (&ge; +40%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Harga terpantau jauh melampaui harga rata-rata sekitar. Pastikan konfirmasi
                    harga sebelum pesan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
            <p className="font-semibold">💡 Ikut Berkontribusi:</p>
            <p className="mt-0.5 text-[11px] text-sky-200/90">
              Kamu bisa membantu sesama dengan mengunggah foto struk saat memberikan ulasan di
              Lokaloka!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          Mengerti, Lanjut Kulineran
        </button>
      </div>
    </div>
  );
}
