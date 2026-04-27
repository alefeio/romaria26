"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";

type Photo = { id: string; imageUrl: string; caption: string | null };

export function GalleryYearLightbox({
  year,
  photos,
}: {
  year: number;
  photos: Photo[];
}) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const safePhotos = useMemo(() => photos.filter((p) => !!p.imageUrl), [photos]);

  const current = safePhotos[idx] ?? null;

  const openAt = useCallback(
    (i: number) => {
      if (safePhotos.length === 0) return;
      const nextIdx = Math.max(0, Math.min(safePhotos.length - 1, i));
      setIdx(nextIdx);
      setOpen(true);
    },
    [safePhotos.length]
  );

  const close = useCallback(() => setOpen(false), []);

  const prev = useCallback(() => {
    if (safePhotos.length === 0) return;
    setIdx((v) => (v - 1 + safePhotos.length) % safePhotos.length);
  }, [safePhotos.length]);

  const next = useCallback(() => {
    if (safePhotos.length === 0) return;
    setIdx((v) => (v + 1) % safePhotos.length);
  }, [safePhotos.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, open, prev]);

  if (safePhotos.length === 0) {
    return <p className="text-center text-[var(--igh-muted)]">Nenhuma foto cadastrada para este ano.</p>;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {safePhotos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openAt(i)}
            className="group overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]"
            title={p.caption ?? ""}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.caption ?? ""}
              className="h-56 w-full object-cover transition-transform group-hover:scale-[1.02]"
              loading="lazy"
            />
            {p.caption ? (
              <div className="border-t border-[var(--card-border)] p-3 text-xs text-[var(--text-secondary)]">{p.caption}</div>
            ) : null}
          </button>
        ))}
      </div>

      <Modal
        open={open}
        title={current ? `Galeria ${year} • ${idx + 1}/${safePhotos.length}` : `Galeria ${year}`}
        onClose={close}
        size="large"
      >
        {!current ? null : (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-lg border border-[var(--card-border)] bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.imageUrl} alt={current.caption ?? ""} className="max-h-[70vh] w-full object-contain bg-black/5" />

              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Foto anterior"
              >
                ←
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Próxima foto"
              >
                →
              </button>
            </div>

            {current.caption ? <div className="text-sm text-[var(--text-secondary)]">{current.caption}</div> : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--text-muted)]">Dica: use as setas do teclado (← →) para navegar.</div>
              <a href={current.imageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                Abrir imagem em nova aba
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

