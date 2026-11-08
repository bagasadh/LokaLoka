import React, { useState } from "react";
import { AlertTriangle, CreditCard, Pencil, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { formatRupiah, type MenuItem, type Warung } from "@/lib/warung-data";

export function ReportPriceModal({
  warung,
  initialItem,
  onClose,
}: {
  warung: Warung;
  initialItem: MenuItem | null;
  onClose: () => void;
}) {
  const s = useStore();
  const [tab, setTab] = useState<"update_price" | "add_menu" | "getok_alert">(
    initialItem ? "update_price" : warung.menu.length > 0 ? "update_price" : "add_menu",
  );

  // Ubah harga
  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItem?.id || warung.menu[0]?.id || "",
  );
  const selectedItem = warung.menu.find((m) => m.id === selectedItemId);
  const [updatedPrice, setUpdatedPrice] = useState<string>(
    initialItem ? String(initialItem.price) : warung.menu[0] ? String(warung.menu[0].price) : "",
  );

  // Tambah menu
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [newMenuCategory, setNewMenuCategory] = useState<"makanan" | "minuman">("makanan");

  // Getok alert
  const [getokItemName, setGetokItemName] = useState(initialItem?.name || "");
  const [getokPricePaid, setGetokPricePaid] = useState("");

  // Shared
  const [reporterName, setReporterName] = useState(s.user?.name || "");
  const [reportNote, setReportNote] = useState("");
  const [acceptsQris, setAcceptsQris] = useState<boolean>(Boolean(warung.hasQris));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actions.setWarungQris(warung.id, acceptsQris);
    if (tab === "update_price") {
      const p = parseInt(updatedPrice.replace(/\D/g, ""), 10);
      if (!selectedItem || isNaN(p) || p <= 0) {
        toast.error("Masukkan harga baru yang valid");
        return;
      }
      actions.updateMenuItemPrice(warung.id, selectedItem.id, p, reporterName, reportNote);
      toast.success(`Harga ${selectedItem.name} berhasil diperbarui menjadi ${formatRupiah(p)}`);
      onClose();
    } else if (tab === "add_menu") {
      const p = parseInt(newMenuPrice.replace(/\D/g, ""), 10);
      if (!newMenuName.trim() || isNaN(p) || p <= 0) {
        toast.error("Nama menu dan harga wajib diisi");
        return;
      }
      actions.addMenuItem(
        warung.id,
        {
          name: newMenuName.trim(),
          price: p,
          category: newMenuCategory,
        },
        reporterName,
        reportNote,
      );
      toast.success(`Menu "${newMenuName.trim()}" berhasil ditambahkan ke warung!`);
      onClose();
    } else {
      const p = parseInt(getokPricePaid.replace(/\D/g, ""), 10);
      if (!getokItemName.trim() || isNaN(p) || p <= 0) {
        toast.error("Lengkapi nama makanan dan harga yang ditagih");
        return;
      }
      actions.reportGetokAlert(warung.id, {
        itemName: getokItemName.trim(),
        pricePaid: p,
        note: reportNote.trim(),
        reporter: reporterName,
      });
      toast.success(
        "Laporan indikasi getok harga diterima. Terima kasih sudah membantu melindungi sesama warga!",
      );
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] max-w-md w-full overflow-y-auto rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="font-display text-base font-bold text-foreground">
              Lapor Perubahan Menu & Harga
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Jenis Laporan */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("update_price")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "update_price"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Ubah Harga</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("add_menu")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "add_menu"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("getok_alert")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "getok_alert"
                ? "bg-destructive text-destructive-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Getok</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {tab === "update_price" && (
            <>
              {warung.menu.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada menu di warung ini. Silakan gunakan tab "Tambah Menu".
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Pilih Menu yang Ingin Diubah
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => {
                        setSelectedItemId(e.target.value);
                        const found = warung.menu.find((m) => m.id === e.target.value);
                        if (found) setUpdatedPrice(String(found.price));
                      }}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-xs text-foreground outline-none focus:border-primary"
                    >
                      {warung.menu.map((m) => (
                        <option key={m.id} value={m.id} className="bg-card text-foreground">
                          {m.name} (saat ini {formatRupiah(m.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Harga Riil Terbaru (Rp)
                    </label>
                    <input
                      type="number"
                      value={updatedPrice}
                      onChange={(e) => setUpdatedPrice(e.target.value)}
                      placeholder="Contoh: 16000"
                      className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {tab === "add_menu" && (
            <>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Nama Menu / Minuman Baru
                </label>
                <input
                  type="text"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Contoh: Ayam Bakar Madu"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-foreground">Kategori</label>
                  <select
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value as "makanan" | "minuman")}
                    className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="makanan" className="bg-card text-foreground">
                      Makanan
                    </option>
                    <option value="minuman" className="bg-card text-foreground">
                      Minuman
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Harga (Rp)</label>
                  <input
                    type="number"
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(e.target.value)}
                    placeholder="Contoh: 18000"
                    className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {tab === "getok_alert" && (
            <>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                <p className="font-bold flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Peringatan Getok Harga
                </p>
                <p className="mt-1 text-muted-foreground text-[11px]">
                  Bantu sesama pembeli agar tidak tertipu harga yang sengaja ditembak mahal tanpa
                  daftar menu.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Menu yang Dipesan</label>
                <input
                  type="text"
                  value={getokItemName}
                  onChange={(e) => setGetokItemName(e.target.value)}
                  placeholder="Contoh: Es Teh Manis / Nasi Ayam"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Harga yang Ditagih (Rp)
                </label>
                <input
                  type="number"
                  value={getokPricePaid}
                  onChange={(e) => setGetokPricePaid(e.target.value)}
                  placeholder="Contoh: 15000 (untuk es teh)"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground">Nama Pelapor</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Nama kamu (misal: Budi / Anonim)"
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Catatan / Bukti (Opsional)
            </label>
            <input
              type="text"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Contoh: Sudah lihat menu dinding baru / nota tertulis"
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={acceptsQris}
                onChange={(e) => setAcceptsQris(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <CreditCard className="h-4 w-4 text-cyan-400" />
              <span>Warung ini menerima pembayaran QRIS</span>
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground ml-6.5">
              Centang jika warung sudah menyediakan QRIS / e-wallet.
            </p>
          </div>

          <div className="mt-5 flex gap-2 pt-2 border-t border-white/10">
            <button
              type="submit"
              className={`h-11 flex-1 rounded-2xl text-xs font-bold transition active:scale-95 shadow-md ${
                tab === "getok_alert"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {tab === "getok_alert" ? "Kirim Laporan Getok Harga" : "Simpan & Update Harga"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-white/10 bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
