import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRight, Dices, Navigation, RotateCcw, Sparkles, Store, X } from "lucide-react";
import {
  PLACEHOLDER_COVER,
  distanceKm,
  formatDistance,
  formatRupiah,
  hoursLabel,
  minPrice,
  openState,
  type Warung,
} from "@/lib/warung-data";

interface GachaModalProps {
  warungs: Warung[];
  userLocation: { lat: number; lng: number };
  onClose: () => void;
  onSelectWarung: (id: string) => void;
  onOpenRoute?: (warung: Warung) => void;
}

type GachaFilter = "all" | "murah" | "buka";

function playTick(audioCtx: AudioContext | null) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch {
    /* abaikan */
  }
}

function playWin(audioCtx: AudioContext | null) {
  if (!audioCtx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const start = audioCtx.currentTime + i * 0.09;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.linearRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch {
    /* abaikan */
  }
}

export default function GachaModal({
  warungs,
  userLocation,
  onClose,
  onSelectWarung,
  onOpenRoute,
}: GachaModalProps) {
  const [filter, setFilter] = useState<GachaFilter>("all");
  const [rolling, setRolling] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [winner, setWinner] = useState<Warung | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Filter kandidat warung sesuai tab
  const candidates = warungs.filter((w) => {
    if (filter === "murah") {
      const lowest = minPrice(w);
      return lowest !== null && lowest <= 15000;
    }
    if (filter === "buka") {
      return openState(w) === "open";
    }
    return true;
  });

  // Putar / Kocok Warung
  const spin = useCallback(() => {
    if (candidates.length === 0) return;
    setRolling(true);
    setWinner(null);

    // Audio Context lazy init
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }

    const totalSteps = 24 + Math.floor(Math.random() * 8);
    let step = 0;
    let delay = 50;

    const tick = () => {
      step++;
      const nextIdx = Math.floor(Math.random() * candidates.length);
      setCurrentIndex(nextIdx);
      playTick(audioCtxRef.current);
      if (navigator.vibrate) navigator.vibrate(15);

      if (step >= totalSteps) {
        // Berhenti dan tetapkan pemenang
        const finalWinner = candidates[nextIdx] ?? null;
        setWinner(finalWinner);
        setRolling(false);
        playWin(audioCtxRef.current);
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      } else {
        // Melambat secara bertahap (ease-out)
        if (step > totalSteps - 8) delay += 45;
        else if (step > totalSteps - 14) delay += 20;
        setTimeout(tick, delay);
      }
    };

    tick();
  }, [candidates]);

  // Otomatis putar pertama kali saat modal dibuka
  useEffect(() => {
    if (candidates.length > 0 && !winner && !rolling) {
      spin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animasi Confetti saat menang
  useEffect(() => {
    if (!winner || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth ?? 350;
    canvas.height = canvas.parentElement?.clientHeight ?? 420;

    const colors = ["#f59e0b", "#38bdf8", "#10b981", "#ec4899", "#8b5cf6", "#ffffff"];
    const particles = Array.from({ length: 45 }, () => ({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 1.2) * 8,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.alpha -= 0.014;
        p.rotation += p.vRot;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color || "#f59e0b";
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [winner]);

  const activeDisplay = winner ?? candidates[currentIndex] ?? null;
  const lowestPrice = activeDisplay ? minPrice(activeDisplay) : null;
  const dist = activeDisplay ? distanceKm(userLocation, activeDisplay) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gacha Kuliner"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-card p-4 shadow-float transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti canvas */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
              <Dices className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Gacha Kuliner</h2>
              <p className="text-[11px] text-muted-foreground">Biar takdir yang pilih makanmu!</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Mode Selector */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-background/80 p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setWinner(null);
            }}
            className={`rounded-lg py-1.5 transition ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter("murah");
              setWinner(null);
            }}
            className={`rounded-lg py-1.5 transition ${
              filter === "murah"
                ? "bg-amber-400 text-black shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ≤ 15rb
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter("buka");
              setWinner(null);
            }}
            className={`rounded-lg py-1.5 transition ${
              filter === "buka"
                ? "bg-emerald-400 text-black shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buka Aja
          </button>
        </div>

        {/* Gacha Stage Card */}
        <div className="mt-4">
          {candidates.length === 0 ? (
            <div className="grid place-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Store className="h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium text-foreground">
                Tidak ada warung yang cocok dengan filter ini.
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-1 text-xs font-semibold text-primary underline"
              >
                Gunakan semua warung
              </button>
            </div>
          ) : (
            <div
              className={`relative overflow-hidden rounded-2xl border bg-background/90 p-3.5 transition-all duration-300 ${
                winner
                  ? "border-amber-400/60 ring-2 ring-amber-400/30 shadow-float"
                  : rolling
                    ? "border-primary/50 ring-1 ring-primary/20 scale-[0.99]"
                    : "border-white/10"
              }`}
            >
              {/* Winner ribbon */}
              {winner && (
                <div className="mb-2.5 flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/40 animate-pulse">
                  <Sparkles className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  <span>PILIHAN TAKDIR HARI INI!</span>
                </div>
              )}

              {activeDisplay && (
                <div className="flex items-start gap-3">
                  <img
                    src={activeDisplay.cover || PLACEHOLDER_COVER}
                    alt={activeDisplay.name}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover bg-muted border border-white/5"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-bold text-foreground">
                      {activeDisplay.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {activeDisplay.category} · {formatDistance(dist)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {hoursLabel(activeDisplay)}
                    </p>
                    {lowestPrice !== null && (
                      <div className="mt-2 inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/20">
                        Mulai {formatRupiah(lowestPrice)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex flex-col gap-2">
          {winner ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {onOpenRoute && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenRoute(winner);
                      onClose();
                    }}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-secondary text-xs font-bold text-foreground transition hover:bg-muted active:scale-95"
                  >
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <span>Lihat Rute</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectWarung(winner.id);
                    onClose();
                  }}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-primary text-xs font-bold text-primary-foreground shadow-lg transition active:scale-95 ${
                    !onOpenRoute ? "col-span-2" : ""
                  }`}
                >
                  <span>Buka Menu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={spin}
                disabled={rolling}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-background text-xs font-semibold text-muted-foreground transition hover:text-foreground active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Belum cocok? Putar lagi</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={rolling || candidates.length === 0}
              onClick={spin}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg transition active:scale-95 disabled:opacity-40"
            >
              <Dices className={`h-4 w-4 ${rolling ? "animate-spin" : ""}`} />
              <span>{rolling ? "Sedang Mengocok…" : "Kocok Makanan!"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
