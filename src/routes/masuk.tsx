import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { actions } from "@/lib/store";

type MasukSearch = {
  next?: string;
};

export const Route = createFileRoute("/masuk")({
  validateSearch: (s: Record<string, unknown>): MasukSearch => {
    const nextVal = s["next"];
    if (typeof nextVal === "string") {
      return { next: nextVal };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "Masuk — Lokaloka" },
      {
        name: "description",
        content: "Masuk ke Lokaloka untuk menulis ulasan dan mengelola warungmu.",
      },
      { property: "og:title", content: "Masuk — Lokaloka" },
      {
        property: "og:description",
        content: "Masuk ke Lokaloka untuk menulis ulasan dan mengelola warungmu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Masuk,
});

function Masuk() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const ok = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <Link
        to="/"
        aria-label="Kembali"
        className="grid h-11 w-11 place-items-center rounded-full bg-card"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex flex-1 flex-col justify-center py-8">
        <Logo className="h-24 w-24" />
        <h1 className="mt-4 text-3xl font-bold">Masuk ke Lokaloka</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mode contoh: cukup isi nama dan email, tidak ada kata sandi.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            actions.login(name.trim(), email.trim());
            if (next) window.location.assign(next);
            else navigate({ to: "/" });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama"
            className="h-12 w-full rounded-2xl border bg-card px-4 text-sm outline-none focus:border-ring"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="h-12 w-full rounded-2xl border bg-card px-4 text-sm outline-none focus:border-ring"
          />
          <button
            disabled={!ok}
            className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Masuk
          </button>
        </form>
      </div>
    </main>
  );
}
