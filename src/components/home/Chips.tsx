import {
  ChevronDown,
  CircleDollarSign,
  Clock,
  Coffee,
  CreditCard,
  Dices,
  Heart,
  MapPin,
  Moon,
  Navigation,
  Receipt,
  ShieldCheck,
  Star,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const FILTERS = [
  "Terdekat",
  "Buka sekarang",
  "Bisa QRIS",
  "Kuliner Malam",
  "Bebas Getok",
  "Rating 4+",
  "Favorit",
  "Ada Struk",
  "Makanan",
  "Minuman",
] as const;

export type Filter = (typeof FILTERS)[number];

export interface Area {
  name: string;
  lat: number;
  lng: number;
}

export function Chips({
  filters,
  toggle,
  area,
  onClearArea,
  budget,
  setBudget,
  onOpenGacha,
  onOpenBudget,
  bookmarkCount,
  pinStyle,
  onTogglePinStyle,
}: {
  filters: Filter[];
  toggle: (f: Filter) => void;
  area: Area | null;
  onClearArea: () => void;
  budget: number;
  setBudget: (b: number) => void;
  onOpenGacha: () => void;
  onOpenBudget: () => void;
  bookmarkCount: number;
  pinStyle?: "badge" | "compact";
  onTogglePinStyle?: () => void;
}) {
  return (
    <div className="no-scrollbar -mx-3 mt-2 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 lg:mx-0 lg:flex-wrap lg:px-0">
      {/* Tombol Acak / Gacha */}
      <button
        type="button"
        onClick={onOpenGacha}
        className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-95"
      >
        <Dices className="h-3.5 w-3.5 text-amber-400" />
        <span>Gacha</span>
      </button>

      {/* Mode Penanda Peta (Harga vs Pin) */}
      {onTogglePinStyle && (
        <button
          type="button"
          onClick={onTogglePinStyle}
          className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#262626] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-[#2e2e2e] active:scale-95"
          title="Ganti tampilan penanda warung di peta"
        >
          {pinStyle === "badge" ? (
            <>
              <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Pin: Harga</span>
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Pin: Titik</span>
            </>
          )}
        </button>
      )}

      {/* Filter Budget Mahasiswa */}
      <button
        type="button"
        onClick={onOpenBudget}
        className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors active:scale-95 ${
          budget > 0
            ? "bg-foreground text-background font-semibold"
            : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
        }`}
      >
        <CircleDollarSign
          className={`h-3.5 w-3.5 ${budget > 0 ? "text-background" : "text-muted-foreground"}`}
        />
        <span>{budget > 0 ? `≤ Rp ${budget / 1000}rb` : "Budget"}</span>
        {budget > 0 ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setBudget(0);
              toast.info("Filter budget dinonaktifkan");
            }}
            className="ml-0.5 -mr-1 grid h-4 w-4 place-items-center rounded hover:bg-black/15 active:scale-90"
            title="Reset filter budget"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : (
          <ChevronDown className="h-3 w-3 opacity-60" />
        )}
      </button>

      {/* Filter Favorit */}
      <button
        type="button"
        onClick={() => toggle("Favorit")}
        className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors active:scale-95 ${
          filters.includes("Favorit")
            ? "bg-foreground text-background font-semibold"
            : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
        }`}
      >
        <Heart
          className={`h-3 w-3 ${
            filters.includes("Favorit") ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
          }`}
        />
        <span>Favorit</span>
        {bookmarkCount > 0 && <span className="opacity-75">({bookmarkCount})</span>}
      </button>

      {area && (
        <button
          onClick={onClearArea}
          aria-label={`Hapus lokasi pencarian ${area.name}`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-2.5 text-xs font-semibold text-background transition-transform active:scale-95"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[10rem] truncate">{area.name}</span>
          <X className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      {FILTERS.filter((f) => f !== "Favorit").map((f) => {
        const on = filters.includes(f);
        return (
          <button
            key={f}
            onClick={() => toggle(f)}
            className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors active:scale-95 ${
              on
                ? "bg-foreground text-background font-semibold"
                : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
            }`}
          >
            {f === "Terdekat" && <Navigation className="h-3 w-3" />}
            {f === "Buka sekarang" && <Clock className="h-3 w-3" />}
            {f === "Bisa QRIS" && <CreditCard className="h-3 w-3" />}
            {f === "Kuliner Malam" && <Moon className="h-3 w-3" />}
            {f === "Bebas Getok" && <ShieldCheck className="h-3.5 w-3.5" />}
            {f === "Rating 4+" && (
              <Star
                className={`h-3 w-3 ${
                  on ? "fill-background text-background" : "fill-amber-400 text-amber-400"
                }`}
              />
            )}
            {f === "Ada Struk" && <Receipt className="h-3 w-3" />}
            {f === "Makanan" && <Utensils className="h-3 w-3" />}
            {f === "Minuman" && <Coffee className="h-3 w-3" />}
            <span>{f}</span>
          </button>
        );
      })}
    </div>
  );
}
