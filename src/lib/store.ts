import { useSyncExternalStore } from "react";
import { resetGeoToDefault } from "./geo";
import { getKnownPlace } from "./places";
import {
  SEED_COMMENTS,
  SEED_REVIEWS,
  WARUNGS,
  type CommentReply,
  type MenuItem,
  type PriceSource,
  type Review,
  type Warung,
  type WarungComment,
} from "./warung-data";

export interface AppSettings {
  locationEnabled: boolean;
  mapTheme: "dark" | "light";
}

export const DEFAULT_SETTINGS: AppSettings = {
  locationEnabled: true,
  mapTheme: "dark",
};

export interface PriceReport {
  id: string;
  warungId: string;
  reporter: string;
  type: "update_price" | "add_menu" | "getok_alert";
  itemName: string;
  oldPrice?: number;
  newPrice?: number;
  note?: string;
  createdAt: number;
}

interface State {
  user: { name: string; email: string; ownerOf: string | null } | null;
  reviews: Review[];
  comments: WarungComment[];
  menuOverrides: Record<string, MenuItem[]>; // warungId -> menu set by owner or community
  bookmarks: string[]; // warungIds saved by user
  settings: AppSettings;
  priceReports: PriceReport[];
  qrisOverrides: Record<string, boolean>; // warungId -> hasQris set by community or owner
}

const KEY = "lokaloka-state-v1";
const initial: State = {
  user: null,
  reviews: SEED_REVIEWS,
  comments: SEED_COMMENTS,
  menuOverrides: {},
  bookmarks: [],
  settings: DEFAULT_SETTINGS,
  priceReports: [],
  qrisOverrides: {},
};
let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state = {
        ...initial,
        ...p,
        bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks : [],
        comments: Array.isArray(p.comments) ? p.comments : SEED_COMMENTS,
        priceReports: Array.isArray(p.priceReports) ? p.priceReports : [],
        qrisOverrides:
          p.qrisOverrides && typeof p.qrisOverrides === "object" ? p.qrisOverrides : {},
        settings: {
          ...DEFAULT_SETTINGS,
          ...(p.settings && typeof p.settings === "object" ? p.settings : {}),
        },
      };
    }
  } catch {
    /* ignore */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota: photos too big, keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  queueMicrotask(l);
  return () => listeners.delete(l);
}

export function useStore() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export const actions = {
  login(name: string, email: string) {
    set({ user: { name, email, ownerOf: null } });
  },
  logout() {
    set({ user: null });
  },
  claimWarung(id: string) {
    if (!state.user) return;
    set({ user: { ...state.user, ownerOf: id } });
  },
  unclaimWarung() {
    if (!state.user) return;
    set({ user: { ...state.user, ownerOf: null } });
  },
  addReview(r: Review) {
    set({ reviews: [r, ...state.reviews] });
  },
  toggleBookmark(id: string): boolean {
    const list = state.bookmarks ?? [];
    const exists = list.includes(id);
    const next = exists ? list.filter((x) => x !== id) : [...list, id];
    set({ bookmarks: next });
    return !exists;
  },
  setMenu(warungId: string, menu: MenuItem[]) {
    set({ menuOverrides: { ...state.menuOverrides, [warungId]: menu } });
  },
  updateMenuItemPrice(
    warungId: string,
    menuItemId: string,
    newPrice: number,
    reporter?: string,
    note?: string,
  ): boolean {
    const currentWarung = getWarung(state, warungId);
    if (!currentWarung) return false;
    const oldItem = currentWarung.menu.find((m) => m.id === menuItemId);
    if (!oldItem) return false;

    const isOwner = state.user?.ownerOf === warungId;
    const nextMenu = currentWarung.menu.map((m) =>
      m.id === menuItemId
        ? {
            ...m,
            price: Math.max(0, Math.round(newPrice)),
            source: (isOwner ? "owner" : "community") as PriceSource,
            updatedMinAgo: 0,
          }
        : m,
    );

    const report: PriceReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      warungId,
      reporter:
        reporter?.trim() || state.user?.name || (isOwner ? "Pemilik Warung" : "Warga Lokal"),
      type: "update_price",
      itemName: oldItem.name,
      oldPrice: oldItem.price,
      newPrice: Math.max(0, Math.round(newPrice)),
      note: note?.trim() || "",
      createdAt: Date.now(),
    };

    set({
      menuOverrides: { ...state.menuOverrides, [warungId]: nextMenu },
      priceReports: [report, ...(state.priceReports ?? [])],
    });
    return true;
  },
  addMenuItem(
    warungId: string,
    item: { name: string; price: number; category: "makanan" | "minuman"; photo?: string },
    reporter?: string,
    note?: string,
  ): MenuItem | null {
    const currentWarung = getWarung(state, warungId);
    if (!currentWarung || !item.name.trim()) return null;

    const isOwner = state.user?.ownerOf === warungId;
    const newItem: MenuItem = {
      id: `m-comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name.trim(),
      price: Math.max(0, Math.round(item.price)),
      category: item.category,
      photo: item.photo || "",
      source: isOwner ? "owner" : "community",
      updatedMinAgo: 0,
    };

    const nextMenu = [...currentWarung.menu, newItem];

    const report: PriceReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      warungId,
      reporter:
        reporter?.trim() || state.user?.name || (isOwner ? "Pemilik Warung" : "Warga Lokal"),
      type: "add_menu",
      itemName: newItem.name,
      newPrice: newItem.price,
      note: note?.trim() || "",
      createdAt: Date.now(),
    };

    set({
      menuOverrides: { ...state.menuOverrides, [warungId]: nextMenu },
      priceReports: [report, ...(state.priceReports ?? [])],
    });
    return newItem;
  },
  reportGetokAlert(
    warungId: string,
    alert: { itemName: string; pricePaid: number; note: string; reporter?: string },
  ): PriceReport {
    const report: PriceReport = {
      id: `rep-getok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      warungId,
      reporter: alert.reporter?.trim() || state.user?.name || "Warga Lokal",
      type: "getok_alert",
      itemName: alert.itemName.trim(),
      newPrice: Math.max(0, Math.round(alert.pricePaid)),
      note: alert.note.trim(),
      createdAt: Date.now(),
    };

    set({
      priceReports: [report, ...(state.priceReports ?? [])],
    });
    return report;
  },
  addComment(warungId: string, text: string, author?: string): WarungComment {
    const isOwner = Boolean(state.user?.ownerOf && state.user.ownerOf === warungId);
    const authorName =
      author?.trim() || state.user?.name || (isOwner ? "Pemilik Warung" : "Pengunjung");

    const newComment: WarungComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      warungId,
      author: authorName,
      isOwner,
      createdAt: Date.now(),
      text: text.trim(),
      replies: [],
    };

    set({ comments: [newComment, ...state.comments] });
    return newComment;
  },
  addCommentReply(commentId: string, text: string, author?: string): CommentReply | null {
    const target = state.comments.find((c) => c.id === commentId);
    if (!target) return null;
    const isOwner = Boolean(state.user?.ownerOf && state.user.ownerOf === target.warungId);
    const authorName =
      author?.trim() || state.user?.name || (isOwner ? "Pemilik Warung" : "Warga Lokal");

    const newReply: CommentReply = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: authorName,
      isOwner,
      createdAt: Date.now(),
      text: text.trim(),
    };

    const nextComments = state.comments.map((c) => {
      if (c.id !== commentId) return c;
      return {
        ...c,
        replies: [...c.replies, newReply],
      };
    });

    set({ comments: nextComments });
    return newReply;
  },
  setSettings(patch: Partial<AppSettings>) {
    const nextSettings = { ...state.settings, ...patch };
    set({ settings: nextSettings });
    if (patch.locationEnabled === false) {
      resetGeoToDefault();
    }
  },
  toggleLocationEnabled(): boolean {
    const next = !state.settings.locationEnabled;
    set({ settings: { ...state.settings, locationEnabled: next } });
    if (!next) {
      resetGeoToDefault();
    }
    return next;
  },
  setMapTheme(theme: "dark" | "light") {
    set({ settings: { ...state.settings, mapTheme: theme } });
  },
  setWarungQris(warungId: string, hasQris: boolean) {
    set({
      qrisOverrides: {
        ...(state.qrisOverrides ?? {}),
        [warungId]: hasQris,
      },
    });
  },
};

export function isBookmarked(s: State, id: string): boolean {
  return s.bookmarks?.includes(id) ?? false;
}

export function getWarung(s: State, id: string): Warung | undefined {
  const w = WARUNGS.find((x) => x.id === id) ?? getKnownPlace(id);
  if (!w) return undefined;
  const menu = s.menuOverrides[id];
  const qris = s.qrisOverrides?.[id];
  let res = menu ? { ...w, menu, registered: true } : w;
  if (qris !== undefined) {
    res = { ...res, hasQris: qris };
  }
  return res;
}

export function ratingOf(s: State, id: string) {
  const rs = s.reviews.filter((r) => r.warungId === id);
  if (!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length };
}

export async function readFileAsDataUrl(
  file: File,
  maxDim = 1024,
  quality = 0.75,
): Promise<string> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    };
    img.src = url;
  });
}
