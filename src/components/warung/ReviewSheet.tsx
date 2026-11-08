import { useState } from "react";
import { Camera, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/WarungBits";
import { actions, readFileAsDataUrl } from "@/lib/store";
import { canSubmitReview } from "@/lib/warung-data";

export function ReviewSheet({
  warungId,
  author,
  onClose,
}: {
  warungId: string;
  author: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const ok = canSubmitReview({ rating, receipt });

  const submit = () => {
    if (!ok || !receipt) return;
    actions.addReview({
      id: crypto.randomUUID(),
      warungId,
      author,
      rating,
      text: text.trim(),
      photos,
      receipt,
      createdAt: Date.now(),
    });
    toast.success("Ulasan terkirim. Terima kasih!");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border bg-card sm:rounded-3xl"
      >
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4">
          <h2 className="truncate text-lg font-bold">Tulis ulasan</h2>
          <button
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  aria-label={`${i} bintang`}
                  onClick={() => setRating(i)}
                  className="grid h-11 w-11 place-items-center"
                >
                  <Stars value={i <= rating ? 1 : 0} size={0} />
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-9 w-9 ${i <= rating ? "fill-star text-star" : "fill-none text-muted-foreground"}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Ceritakan pengalamanmu: rasa, harga, pelayanan…"
            className="w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:border-ring"
          />
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Foto makanan (opsional)</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="h-20 w-20 rounded-xl object-cover" />
                  <button
                    aria-label="Hapus foto"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
                      const urls = await Promise.all(files.map((f) => readFileAsDataUrl(f)));
                      setPhotos((ps) => [...ps, ...urls]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Foto struk <span className="text-destructive">*wajib</span>
            </p>
            {receipt ? (
              <div className="relative inline-block">
                <img src={receipt} alt="Struk" className="h-32 rounded-xl object-cover" />
                <button
                  aria-label="Ganti struk"
                  onClick={() => setReceipt(null)}
                  className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
                <Receipt className="h-5 w-5" /> Unggah foto struk sebagai bukti beli
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setReceipt(await readFileAsDataUrl(f));
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t px-4 pt-3 pb-safe">
          <button
            disabled={!ok}
            onClick={submit}
            className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {ok ? "Kirim ulasan" : !rating ? "Pilih rating dulu" : "Lampirkan struk dulu"}
          </button>
        </div>
      </div>
    </div>
  );
}

