import { Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, Settings } from "lucide-react";

/** Tinggi dock (tanpa safe-area) — dipakai juga oleh utilitas `bottom-dock` di styles.css. */
export const DOCK_HEIGHT_REM = 3.5;

/**
 * Navigasi bawah khusus mobile: Peta · Settings.
 * Disembunyikan di layar besar (desktop memakai sidebar).
 */
export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isMapActive = path === "/";
  const isSettingsActive = path === "/settings";

  const item = (active: boolean) =>
    `flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;
  const pill = (active: boolean) =>
    `grid h-7 w-12 place-items-center rounded-full transition-colors ${
      active ? "bg-white/12 text-foreground" : ""
    }`;

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1c1c1c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div
        className="mx-auto flex max-w-xs items-stretch"
        style={{ height: `${DOCK_HEIGHT_REM}rem` }}
      >
        <Link to="/" className={item(isMapActive)} aria-current={isMapActive ? "page" : undefined}>
          <span className={pill(isMapActive)}>
            <MapIcon className="h-[18px] w-[18px]" />
          </span>
          <span>Peta</span>
        </Link>
        <Link
          to="/settings"
          className={item(isSettingsActive)}
          aria-current={isSettingsActive ? "page" : undefined}
        >
          <span className={pill(isSettingsActive)}>
            <Settings className="h-[18px] w-[18px]" />
          </span>
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
