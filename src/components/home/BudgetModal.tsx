import { useEffect } from "react";
import { Check, CircleDollarSign, X } from "lucide-react";

export type BudgetOption = { label: string; desc: string; value: number };

export const BUDGET_OPTIONS: readonly BudgetOption[] = [
  { label: "Semua Budget", desc: "Tampilkan semua warung tanpa batasan harga", value: 0 },
  { label: "≤ 10rb", desc: "Super hemat (gorengan, es teh, lontong, nasi kucing)", value: 10000 },
  {
    label: "≤ 15rb",
    desc: "Paling pas kantong mhs (nasi rames, mie ayam, ketoprak)",
    value: 15000,
  },
  { label: "≤ 20rb", desc: "Kenyang mantap (ayam geprek, nasi padang, soto)", value: 20000 },
  { label: "≤ 30rb", desc: "Makan puas (bebek goreng, iga, kafe & nongkrong)", value: 30000 },
] as const;

export function BudgetModal({
  current,
  onSelect,
  onClose,
}: {
  current: number;
  onSelect: (val: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev === "hidden" ? "" : prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity sm:items-center sm:p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
        className="relative z-10 flex w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-[#202020] p-5 shadow-float sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/15 text-amber-400">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 id="budget-title" className="font-display text-base font-bold text-foreground">
                Budget Mahasiswa
              </h2>
              <p className="text-xs text-muted-foreground">Pilih batas harga menu terendah</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  isSelected
                    ? "border-amber-400/60 bg-amber-500/15 shadow-sm"
                    : "border-white/5 bg-card/60 hover:border-white/15 hover:bg-card"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display text-sm font-bold ${
                        isSelected ? "text-amber-300" : "text-foreground"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.value > 0 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Maks. Rp {opt.value.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                  {opt.desc && <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>}
                </div>

                <div
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-400 text-black"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {current > 0 && (
          <button
            type="button"
            onClick={() => onSelect(0)}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            Hapus Filter Budget
          </button>
        )}
      </div>
    </div>
  );
}
