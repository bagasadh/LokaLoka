import { BadgeCheck, Globe, Star, Users } from "lucide-react";
import { SOURCE_LABEL, type PriceSource } from "@/lib/warung-data";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5"
      aria-label={`${value.toFixed(1)} bintang`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(value) ? "fill-star text-star" : "text-muted-foreground"}
        />
      ))}
    </span>
  );
}

export function SourceBadge({ source }: { source: PriceSource }) {
  const owner = source === "owner";
  const community = source === "community";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        owner
          ? "bg-success/15 text-success border border-success/20"
          : community
            ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
            : "bg-muted text-muted-foreground border border-white/5"
      }`}
    >
      {owner ? (
        <BadgeCheck className="h-3 w-3 shrink-0" />
      ) : community ? (
        <Users className="h-3 w-3 shrink-0 text-amber-400" />
      ) : (
        <Globe className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{SOURCE_LABEL[source]}</span>
    </span>
  );
}
