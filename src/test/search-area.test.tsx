import { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  isNotFound,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetPlaceCaches } from "@/lib/places";
import { routeTree } from "@/routeTree.gen";

// Leaflet butuh browser sungguhan: ganti dengan penampung yang mencatat perintah pindah peta.
const mapFocus = vi.fn();
vi.mock("@/components/MapView", () => ({
  default: ({ warungs, focus }: { warungs: { id: string; name: string }[]; focus?: unknown }) => {
    mapFocus(focus);
    return <div data-testid="map">{warungs.map((w) => w.name).join("|")}</div>;
  },
}));

const KALISARI = { lat: -6.3433, lng: 106.8683 };
const json = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

function mockNetwork() {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("photon.komoot.io")) {
      return json({
        features: [
          {
            geometry: { coordinates: [KALISARI.lng, KALISARI.lat] },
            properties: {
              osm_type: "R",
              osm_id: 1,
              name: "Kalisari",
              city: "Jakarta Timur",
              country: "Indonesia",
            },
          },
        ],
      });
    }
    // Overpass: warung di Kalisari hanya muncul kalau yang diminta memang titik Kalisari
    const body = decodeURIComponent(String(init?.body ?? ""));
    if (body.includes(String(KALISARI.lat))) {
      return json({
        elements: [
          {
            type: "node",
            id: 1,
            lat: KALISARI.lat,
            lon: KALISARI.lng,
            tags: { name: "Bakso Kalisari Jaya", amenity: "restaurant" },
          },
          {
            type: "node",
            id: 2,
            lat: KALISARI.lat,
            lon: KALISARI.lng,
            tags: { name: "Kopi Pojok Kalisari", amenity: "cafe" },
          },
        ],
      });
    }
    return json({ elements: [] }); // sekitar lokasi default: tidak ada hasil peta
  });
  vi.stubGlobal("fetch", f);
  return f;
}

async function renderHome() {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findAllByLabelText("Lokasi saya");
}

beforeEach(() => {
  sessionStorage.clear();
  resetPlaceCaches();
  mapFocus.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("search tempat di peta", () => {
  it("mencari Kalisari (bukan lokasi default), memindahkan peta, dan mendeteksi warung di sana", async () => {
    const f = mockNetwork();
    await renderHome();

    // Di lokasi default belum ada warung Kalisari
    expect(screen.getByTestId("map").textContent).not.toContain("Kalisari");

    // Ada dua kotak search (mobile + desktop; di jsdom CSS tidak menyembunyikan salah satunya): pakai yang pertama
    const input = screen.getAllByPlaceholderText("Cari tempat, warung, atau menu")[0]!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "kalisari" } });

    // Hasil tempat muncul setelah jeda ketik
    const option = (
      await screen.findAllByRole("option", { name: /Kalisari/ }, { timeout: 3000 })
    )[0]!;
    expect(within(option).getByText("Jakarta Timur, Indonesia")).toBeTruthy();
    fireEvent.click(option);

    // Peta diperintah pindah ke Kalisari
    await waitFor(() =>
      expect(mapFocus).toHaveBeenCalledWith(
        expect.objectContaining({ lat: KALISARI.lat, lng: KALISARI.lng, animate: true }),
      ),
    );

    // Warung di sekitar Kalisari terdeteksi: tampil di peta dan di daftar
    await waitFor(() =>
      expect(screen.getByTestId("map").textContent).toContain("Bakso Kalisari Jaya"),
    );
    expect(screen.getByTestId("map").textContent).toContain("Kopi Pojok Kalisari");
    expect(screen.getAllByText("Bakso Kalisari Jaya").length).toBeGreaterThan(0);

    // Warung contoh di Menteng (jauh dari Kalisari) tidak ikut tampil
    expect(screen.getByTestId("map").textContent).not.toContain("Bu Sri");

    // Pil lokasi pencarian + judul daftar
    expect(screen.getAllByLabelText("Hapus lokasi pencarian Kalisari").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warung di Kalisari · 2/).length).toBeGreaterThan(0);

    // Dua panggilan Overpass: lokasi default, lalu Kalisari
    const overpassCalls = f.mock.calls.filter(([u]) => String(u).includes("overpass"));
    expect(overpassCalls.length).toBe(2);

    // Tombol "Lokasi saya" mengembalikan ke lokasi default dan menghapus pil
    await act(async () => {
      fireEvent.click(screen.getAllByLabelText("Lokasi saya")[0]!);
    });
    await waitFor(() =>
      expect(screen.queryAllByLabelText("Hapus lokasi pencarian Kalisari")).toHaveLength(0),
    );
    await waitFor(() => expect(screen.getByTestId("map").textContent).toContain("Bu Sri"));
    expect(screen.getByTestId("map").textContent).not.toContain("Kalisari");
  });

  it("menampilkan pesan jelas kalau tempat tidak ditemukan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        json(
          url.includes("photon")
            ? { features: [] }
            : url.includes("nominatim")
              ? []
              : { elements: [] },
        ),
      ),
    );
    await renderHome();
    const input = screen.getAllByPlaceholderText("Cari tempat, warung, atau menu")[0]!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzxxqq" } });
    expect(
      (await screen.findAllByText(/tidak ditemukan/, undefined, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
  });

  it("menampilkan tombol coba lagi kalau deteksi warung gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
      ),
    );
    await renderHome();
    expect(
      (await screen.findAllByText("Coba lagi", undefined, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
  });
});

describe("profil tempat hasil deteksi", () => {
  it("link /warung/osm-… yang dibuka langsung tetap termuat dan menangani data yang kosong", async () => {
    const f = vi.fn(() =>
      json({
        elements: [
          {
            type: "node",
            id: 777,
            lat: KALISARI.lat,
            lon: KALISARI.lng,
            tags: { name: "Bakso Kalisari Jaya", amenity: "restaurant" },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", f);
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/warung/osm-node-777"] }),
    });
    await router.load();
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "Bakso Kalisari Jaya" })).toBeTruthy();
    expect(screen.getByText("Jam buka belum diketahui")).toBeTruthy();
    expect(screen.getByText("Menu dan harga untuk tempat ini belum tersedia.")).toBeTruthy();
    expect(screen.getByText(/terdeteksi dari peta OpenStreetMap/)).toBeTruthy();
    // tidak ada nomor telepon: tombol Telepon nonaktif
    expect(screen.getByText("Telepon").closest("a")?.getAttribute("aria-disabled")).toBe("true");
  });

  it("id yang tidak dikenal menghasilkan halaman tidak ditemukan, bukan error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ elements: [] })),
    );
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/warung/osm-node-999"] }),
    });
    await router.load();
    // notFound ditangkap di match root, sama seperti id sembarang di versi sebelumnya
    expect(isNotFound(router.state.matches[0]?.error)).toBe(true);
  });
});
