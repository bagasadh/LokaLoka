import { Receipt, X } from "lucide-react";

export function ReceiptModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto struk pembelian"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-card p-3 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
            <Receipt className="h-4 w-4" />
            <span>Bukti Struk Pembelian</span>
          </div>
          <button
            type="button"
            aria-label="Tutup foto struk"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <img
          src={src}
          alt="Bukti struk pembelian"
          className="max-h-[70vh] w-full rounded-2xl object-contain bg-black/40"
        />
      </div>
    </div>
  );
}
