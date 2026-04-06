"use client";

import { useCallback, useState } from "react";

export type SiteUploadKind =
  | "logo"
  | "favicon"
  | "opengraph"
  | "banners"
  | "partners"
  | "projects"
  | "testimonials"
  | "news"
  | "transparency"
  | "about"
  | "contato"
  | "packages";

type Props = {
  kind: SiteUploadKind;
  id?: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
  multiple?: boolean;
};

export function ImageUploadField({
  kind,
  id,
  onUploaded,
  currentUrl,
  label = "Upload de imagem",
  accept = "image/*",
  multiple = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = useCallback(
    async (file: File): Promise<string | null> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      if (id) formData.append("id", id);

      const uploadRes = await fetch("/api/admin/site/uploads", {
        method: "POST",
        body: formData,
      });
      const uploadJson = (await uploadRes.json()) as {
        ok?: boolean;
        data?: { url?: string };
        error?: { message?: string };
      };
      if (!uploadRes.ok || !uploadJson.ok || !uploadJson.data?.url) {
        return null;
      }
      return uploadJson.data.url;
    },
    [kind, id]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      const fileList = multiple ? Array.from(files) : [files[0]];
      setError(null);
      setUploading(true);
      let lastError: string | null = null;
      try {
        for (const file of fileList) {
          const url = await uploadOne(file);
          if (url) onUploaded(url);
          else lastError = lastError ?? "Falha no upload de algum arquivo.";
        }
        if (lastError) setError(lastError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [multiple, onUploaded, uploadOne]
  );

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
            multiple={multiple}
          />
          {uploading ? "Enviando…" : multiple ? "Escolher arquivos" : "Escolher arquivo"}
        </label>
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Ver imagem atual
          </a>
        )}
      </div>
      {currentUrl && (
        <div className="mt-1">
          <img src={currentUrl} alt="Preview" className="max-h-24 rounded border border-[var(--card-border)] object-cover" />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
