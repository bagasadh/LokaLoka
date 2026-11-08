import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { actions, getWarung, readFileAsDataUrl, useStore } from "@/lib/store";
import { PLACEHOLDER_COVER, WARUNGS, formatRupiah, type MenuItem } from "@/lib/warung-data";

export const Route = createFileRoute("/pemilik")({
  head: () => ({
    meta: [
      { title: "Untuk pemilik warung — Lokaloka" },
      {
        name: "description",
        content: "Daftarkan warungmu dan perbarui menu serta harga secara langsung.",
      },
      { property: "og:title", content: "Untuk pemilik warung — Lokaloka" },
      {
        property: "og:description",
        content: "Daftarkan warungmu dan perbarui menu serta harga secara langsung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pemilik,
});

function Pemilik() {
  const s = useStore();
  const owned = s.user?.ownerOf ? getWarung(s, s.user.ownerOf) : undefined;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pt-safe pb-28">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <Link
          to="/"
          aria-label="Kembali"
          className="grid h-11 w-11 place-items-center rounded-full bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-xl font-bold">Untuk pemilik warung</h1>
      </div>

      {!s.user ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Masuk dulu untuk mendaftarkan warung.</p>
          <Link
            to="/masuk"
            search={{ next: "/pemilik" }}
            className="mt-4 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Masuk
          </Link>
        </div>
      ) : !owned ? (
        <section className="mt-6">
          <p className="text-sm text-muted-foreground">
            Pilih salah satu warung contoh di bawah, atau buka profil warung mana saja dari peta
            lalu ketuk <strong>"Ini warung saya"</strong>.
          </p>
          <ul className="mt-4 space-y-2">
            {WARUNGS.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => {
                    actions.claimWarung(w.id);
                    toast.success(`${w.name} terdaftar`);
                  }}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-card p-3 text-left transition-colors hover:bg-card/80"
                >
                  <img
                    src={w.cover || PLACEHOLDER_COVER}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover bg-muted"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {w.address}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <MenuEditor warungId={owned.id} name={owned.name} initial={owned.menu} />
      )}
    </main>
  );
}

function MenuEditor({
  warungId,
  name,
  initial,
}: {
  warungId: string;
  name: string;
  initial: MenuItem[];
}) {
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const upd = (i: number, patch: Partial<MenuItem>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = () => {
    actions.setMenu(
      warungId,
      items.filter((x) => x.name.trim()).map((x) => ({ ...x, source: "owner", updatedMinAgo: 0 })),
    );
    toast.success("Harga diperbarui, langsung tampil di peta");
  };

  return (
    <section className="mt-6 pb-24">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate font-semibold">{name}</p>
        <div className="flex items-center gap-3">
          <Link to="/warung/$id" params={{ id: warungId }} className="shrink-0 text-sm underline">
            Lihat profil
          </Link>
          <button
            type="button"
            onClick={() => {
              actions.unclaimWarung();
              toast.info("Klaim warung dilepas");
            }}
            className="shrink-0 text-xs text-muted-foreground underline transition-colors hover:text-destructive"
          >
            Ganti warung
          </button>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((m, i) => (
          <li
            key={m.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3"
          >
            <label className="cursor-pointer">
              {m.photo ? (
                <img src={m.photo} alt="" className="h-16 w-16 rounded-xl object-cover bg-muted" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-white/5 bg-muted text-muted-foreground">
                  <Utensils className="h-6 w-6 opacity-60" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) upd(i, { photo: await readFileAsDataUrl(f) });
                }}
              />
            </label>
            <div className="min-w-0 space-y-2">
              <input
                value={m.name}
                onChange={(e) => upd(i, { name: e.target.value })}
                placeholder="Nama menu"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none"
              />
              <input
                inputMode="numeric"
                value={m.price || ""}
                onChange={(e) => upd(i, { price: Number(e.target.value.replace(/\D/g, "")) })}
                placeholder="Harga"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none"
              />
              <p className="text-xs text-muted-foreground">{formatRupiah(m.price)}</p>
            </div>
            <button
              aria-label="Hapus"
              onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
              className="grid h-10 w-10 place-items-center rounded-full bg-muted"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          setItems((xs) => [
            ...xs,
            {
              id: crypto.randomUUID(),
              name: "",
              price: 0,
              photo: initial[0]?.photo ?? "",
              category: "makanan",
              source: "owner",
              updatedMinAgo: 0,
            },
          ])
        }
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm"
      >
        <Plus className="h-4 w-4" /> Tambah menu
      </button>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={save}
            className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            Simpan harga
          </button>
        </div>
      </div>
    </section>
  );
}
