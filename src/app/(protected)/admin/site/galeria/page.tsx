"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type YearRow = {
  id: string;
  year: number;
  title: string | null;
  isActive: boolean;
  _count?: { photos: number };
};

type PhotoRow = {
  id: string;
  yearId: string;
  imageUrl: string;
  caption: string | null;
  order: number;
};

async function uploadGalleryImage(yearId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", "gallery");
  formData.append("id", yearId);
  const res = await fetch("/api/admin/site/uploads", { method: "POST", body: formData });
  const json = (await res.json()) as ApiResponse<{ url: string }>;
  if (!res.ok || !json.ok) {
    throw new Error(!json.ok ? json.error.message : "Falha no upload.");
  }
  return json.data.url;
}

export default function AdminSiteGaleriaPage() {
  const toast = useToast();
  const [loadingYears, setLoadingYears] = useState(true);
  const [years, setYears] = useState<YearRow[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedYearId) ?? null,
    [selectedYearId, years]
  );

  const [newYear, setNewYear] = useState<string>(String(new Date().getFullYear()));
  const [newYearTitle, setNewYearTitle] = useState<string>("");
  const [creatingYear, setCreatingYear] = useState(false);

  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const loadYears = useCallback(async () => {
    setLoadingYears(true);
    try {
      const res = await fetch("/api/admin/site/gallery/years");
      const json = (await res.json()) as ApiResponse<{ items: YearRow[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar anos.");
        return;
      }
      setYears(json.data.items);
      if (!selectedYearId && json.data.items.length) {
        setSelectedYearId(json.data.items[0]!.id);
      }
    } finally {
      setLoadingYears(false);
    }
  }, [selectedYearId, toast]);

  const loadPhotos = useCallback(
    async (yearId: string) => {
      setLoadingPhotos(true);
      try {
        const res = await fetch(`/api/admin/site/gallery/photos?yearId=${encodeURIComponent(yearId)}`);
        const json = (await res.json()) as ApiResponse<{ items: PhotoRow[] }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao carregar fotos.");
          return;
        }
        setPhotos(json.data.items);
      } finally {
        setLoadingPhotos(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    if (!selectedYearId) return;
    void loadPhotos(selectedYearId);
  }, [loadPhotos, selectedYearId]);

  async function createYear() {
    const yearNum = Number.parseInt(newYear.trim(), 10);
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
      toast.push("error", "Informe um ano válido (ex.: 2026).");
      return;
    }
    setCreatingYear(true);
    try {
      const res = await fetch("/api/admin/site/gallery/years", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ year: yearNum, title: newYearTitle.trim() || undefined, isActive: true }),
      });
      const json = (await res.json()) as ApiResponse<{ item: YearRow }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar ano.");
        return;
      }
      toast.push("success", "Ano criado.");
      await loadYears();
      setSelectedYearId(json.data.item.id);
      setNewYearTitle("");
    } finally {
      setCreatingYear(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!window.confirm("Excluir esta foto da galeria?")) return;
    const res = await fetch(`/api/admin/site/gallery/photos/${photoId}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? (json as any).error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Foto excluída.");
    if (selectedYearId) void loadPhotos(selectedYearId);
    void loadYears();
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!selectedYearId) {
      toast.push("error", "Selecione um ano para enviar fotos.");
      return;
    }
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        const f = list[i]!;
        const url = await uploadGalleryImage(selectedYearId, f);
        const res = await fetch("/api/admin/site/gallery/photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ yearId: selectedYearId, imageUrl: url }),
        });
        const json = (await res.json()) as ApiResponse<{ item: PhotoRow }>;
        if (!res.ok || !json.ok) {
          throw new Error(!json.ok ? json.error.message : "Falha ao registrar foto no banco.");
        }
        setUploadProgress({ done: i + 1, total: list.length });
      }
      toast.push("success", "Upload concluído.");
      await loadPhotos(selectedYearId);
      await loadYears();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Galeria de fotos</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Organize as fotos por ano e envie múltiplas imagens de uma vez.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Anos</div>

          <div className="mt-3 flex gap-2">
            <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="Ano" />
            <Button type="button" onClick={() => void createYear()} disabled={creatingYear}>
              {creatingYear ? "…" : "Criar"}
            </Button>
          </div>
          <div className="mt-2">
            <Input
              value={newYearTitle}
              onChange={(e) => setNewYearTitle(e.target.value)}
              placeholder="Título (opcional)"
            />
          </div>

          {loadingYears ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Carregando…</p>
          ) : years.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Nenhum ano cadastrado.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-1">
              {years.map((y) => (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => setSelectedYearId(y.id)}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    y.id === selectedYearId ? "bg-[var(--igh-primary)] text-white" : "hover:bg-[var(--igh-surface)]"
                  }`}
                >
                  <span className="font-medium">
                    {y.year}
                    {y.title ? <span className={y.id === selectedYearId ? "opacity-90" : "text-[var(--text-muted)]"}> · {y.title}</span> : null}
                  </span>
                  <span className={`text-xs ${y.id === selectedYearId ? "opacity-90" : "text-[var(--text-muted)]"}`}>
                    {y._count?.photos ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedYear ? `Fotos de ${selectedYear.year}` : "Selecione um ano"}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {uploadProgress ? `Enviando ${uploadProgress.done}/${uploadProgress.total}…` : "Use upload múltiplo para enviar várias fotos."}
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={!selectedYearId || uploading}
                  onChange={(e) => void onUploadFiles(e.target.files)}
                />
                {uploading ? "Enviando…" : "Upload múltiplo"}
              </label>
            </div>
          </div>

          {loadingPhotos ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Carregando fotos…</p>
          ) : !selectedYearId ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Selecione um ano para ver/enviar fotos.</p>
          ) : photos.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Nenhuma foto neste ano ainda.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.caption ?? ""} className="h-44 w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs text-[var(--text-muted)]">{p.caption ?? "—"}</div>
                      <a href={p.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">
                        Abrir imagem
                      </a>
                    </div>
                    <Button type="button" variant="danger" size="sm" onClick={() => void deletePhoto(p.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

