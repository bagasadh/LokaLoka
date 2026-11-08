import { useEffect, useRef, useState } from "react";

export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Kalau gambar sudah gagal dimuat sebelum React aktif (SSR), onError terlewat; cek manual.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span
        aria-label="Lokaloka"
        role="img"
        className={`${className} grid shrink-0 place-items-center rounded-full bg-white font-bold text-[#202020]`}
      >
        L
      </span>
    );
  }

  return (
    <img
      ref={ref}
      src="/lokaloka-logo-white.png"
      alt="Lokaloka"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 object-contain`}
    />
  );
}
