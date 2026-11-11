import { Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, Settings } from "lucide-react";

/** Tinggi dock (tanpa safe-area) — dipakai juga oleh utilitas `bottom-dock` di styles.css. */
export const DOCK_HEIGHT_REM = 3.5;

/**
 * Navigasi bawah khusus mobile: Peta · Settings.
 * Disembunyikan di layar besar (desktop memakai sidebar).
 */
export function BottomNav({ hidden }: { hidden?: boolean } = {}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isMapActive = path === "/";
  const isSettingsActive = path === "/settings";

  const item = (active: boolean) =>
    `relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
      active
        ? "font-semibold text-foreground"
        : "font-medium text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav
      aria-label="Navigasi utama"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#202020]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-all duration-300 ease-in-out lg:hidden ${
        hidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        className="mx-auto flex max-w-xs items-stretch"
        style={{ height: `${DOCK_HEIGHT_REM}rem` }}
      >
        <Link to="/" className={item(isMapActive)} aria-current={isMapActive ? "page" : undefined}>
          {isMapActive && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" />
          )}
          <MapIcon className="h-[18px] w-[18px]" strokeWidth={isMapActive ? 2.25 : 1.75} />
          <span>Peta</span>
        </Link>
        <Link
          to="/settings"
          className={item(isSettingsActive)}
          aria-current={isSettingsActive ? "page" : undefined}
        >
          {isSettingsActive && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" />
          )}
          <Settings className="h-[18px] w-[18px]" strokeWidth={isSettingsActive ? 2.25 : 1.75} />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
