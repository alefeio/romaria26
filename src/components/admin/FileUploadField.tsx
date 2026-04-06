"use client";

import { useCallback, useState } from "react";
import { attachmentUrlForDownload } from "@/lib/attachment-download-url";

export type SiteFileUploadKind = "transparency";

type Props = {
  kind: SiteFileUploadKind;
  id?: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
};

export function FileUploadField({
  kind,
  id,
  onUploaded,
  currentUrl,
  label = "Upload de arquivo (PDF)",
  accept = ".pdf,application/pdf",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
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
        if (!uploadRes.ok || !uploadJson.ok) {
          setError(uploadJson.error?.message ?? "Falha no upload.");
          return;
        }
        const url = uploadJson.data?.url;
        if (url) {
          onUploaded(url);
        } else {
          setError("Resposta inválida do servidor de upload.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [kind, id, onUploaded]
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
          />
          {uploading ? "Enviando…" : "Escolher PDF"}
        </label>
        {currentUrl && (
          <a
            href={attachmentUrlForDownload(currentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Ver arquivo atual
          </a>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
