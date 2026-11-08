import React, { useMemo, useState } from "react";
import { HelpCircle, MessageCircle, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { formatAgo } from "@/lib/warung-data";

export function DiscussionSection({
  warungId,
  warungName,
}: {
  warungId: string;
  warungName: string;
}) {
  const s = useStore();
  const comments = useMemo(
    () => s.comments.filter((c) => c.warungId === warungId),
    [s.comments, warungId],
  );

  const [questionText, setQuestionText] = useState("");
  const [authorName, setAuthorName] = useState(s.user?.name ?? "");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyAuthor, setReplyAuthor] = useState<Record<string, string>>({});

  const isOwner = Boolean(s.user?.ownerOf && s.user.ownerOf === warungId);

  const quickPrompts = [
    "Patokan lokasi persisnya sebelah mana ya kak?",
    "Parkir mobil atau motor aman dan luas ga ya?",
    "Menu yang paling enak dan recommended apa di sini?",
    "Bisa bayar pakai QRIS atau transfer ga?",
    "Kalau malam jam berapa biasanya menu sudah habis?",
    "Tingkat kepedasannya gimana ya?",
  ];

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast.error("Tulis pertanyaanmu terlebih dahulu");
      return;
    }
    const finalAuthor = s.user?.name || authorName.trim() || "Pengunjung";
    actions.addComment(warungId, questionText, finalAuthor);
    setQuestionText("");
    toast.success("Pertanyaan terkirim! Pemilik atau pengunjung lain bisa segera menjawab.");
  };

  const handleSendReply = (commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (!text) {
      toast.error("Tulis jawaban atau balasanmu terlebih dahulu");
      return;
    }
    const finalAuthor =
      s.user?.name ||
      replyAuthor[commentId]?.trim() ||
      (isOwner ? "Pemilik Warung" : "Warga Sekitar");

    actions.addCommentReply(commentId, text, finalAuthor);
    setReplyText((prev) => ({ ...prev, [commentId]: "" }));
    setActiveReplyId(null);
    toast.success("Balasan berhasil dikirim!");
  };

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Banner Edukatif: Perbedaan Komentar & Ulasan */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <HelpCircle className="h-4 w-4" />
          <span>Ruang Tanya Jawab & Diskusi Terbuka</span>
        </div>
        <p className="mt-1 leading-relaxed">
          Bebas bertanya apa saja seputar patokan lokasi, porsi, atau rasa menu tanpa syarat
          beli/struk. Pemilik warung dan sesama pengunjung bisa saling menjawab!
        </p>
      </div>

      {/* Form Buat Pertanyaan Baru */}
      <form
        onSubmit={handleSendQuestion}
        className="rounded-3xl border border-white/10 bg-card p-4 shadow-sm"
      >
        <h3 className="text-sm font-bold text-foreground">
          Punya Pertanyaan tentang {warungName}?
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tanya patokan gang, rekomendasi menu, fasilitas, atau parkir
        </p>

        {/* Quick Prompt Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setQuestionText(prompt)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-foreground active:scale-95 text-left"
            >
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <textarea
            id="discussion-input"
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Tulis pertanyaanmu di sini..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-background/80 p-3 text-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
          />

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {!s.user ? (
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nama kamu (misal: Rian / Mahasiswa)"
                className="h-10 rounded-xl border border-white/10 bg-background/80 px-3 text-xs outline-none focus:border-primary/50"
              />
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {s.user.name.charAt(0)}
                </span>
                <span>
                  Bertanya sebagai <b>{s.user.name}</b> {isOwner && "👑 (Pemilik)"}
                </span>
              </div>
            )}
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Kirim Pertanyaan</span>
            </button>
          </div>
        </div>
      </form>

      {/* Daftar Pertanyaan & Balasan */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground">
            Semua Pertanyaan & Diskusi ({comments.length})
          </h4>
        </div>

        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
            <p>Belum ada pertanyaan di sini.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Jadilah orang pertama yang bertanya tentang warung ini!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const minAgo = Math.max(1, Math.round((Date.now() - c.createdAt) / 60000));
              const isReplying = activeReplyId === c.id;

              return (
                <article
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-card/60 p-4 shadow-sm"
                >
                  {/* Penanya Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {c.author.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground">{c.author}</p>
                          {c.isOwner && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                              👑 Pemilik
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatAgo(minAgo)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Isi Pertanyaan */}
                  <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground/90">
                    {c.text}
                  </p>

                  {/* Tombol Balas */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveReplyId(isReplying ? null : c.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{isReplying ? "Tutup balasan" : "Balas / Beri Jawaban"}</span>
                      {c.replies.length > 0 && (
                        <span className="font-normal text-muted-foreground">
                          · {c.replies.length} balasan
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Thread Balasan (Nested Replies) */}
                  {c.replies.length > 0 && (
                    <div className="mt-3 space-y-2.5 border-l-2 border-primary/30 pl-3 pt-1">
                      {c.replies.map((rep) => {
                        const repMinAgo = Math.max(
                          1,
                          Math.round((Date.now() - rep.createdAt) / 60000),
                        );
                        return (
                          <div key={rep.id} className="rounded-xl bg-white/[0.03] p-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{rep.author}</span>
                              {rep.isOwner ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                                  👑 Pemilik Warung
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/5 px-1.5 py-0.2 text-[9px] text-muted-foreground">
                                  Warga / Pengunjung
                                </span>
                              )}
                              <span className="text-muted-foreground/70">
                                · {formatAgo(repMinAgo)}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed text-foreground/90">{rep.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Form Input Balasan */}
                  {isReplying && (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-background/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Balas pertanyaan dari <b>{c.author}</b>:
                      </p>
                      <input
                        type="text"
                        value={replyText[c.id] ?? ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Ketik jawaban atau infomu di sini..."
                        className="w-full rounded-xl border border-white/10 bg-background p-2 text-xs outline-none focus:border-primary/50"
                      />
                      <div className="flex items-center justify-between gap-2">
                        {!s.user && (
                          <input
                            type="text"
                            value={replyAuthor[c.id] ?? ""}
                            onChange={(e) =>
                              setReplyAuthor((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            placeholder="Nama kamu (opsional)"
                            className="h-8 rounded-lg border border-white/10 bg-background px-2.5 text-[11px] outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleSendReply(c.id)}
                          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <Send className="h-3 w-3" />
                          <span>Kirim Balasan</span>
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
