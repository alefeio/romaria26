import { randomUUID } from "crypto";

export function getApimgConfig(): { uploadUrl: string; apiKey: string } {
  const uploadUrl = process.env.APIMG_UPLOAD_URL?.trim();
  const apiKey = process.env.APIMG_API_KEY?.trim();
  if (!uploadUrl || !apiKey) {
    throw new Error("APIMG_UPLOAD_URL e APIMG_API_KEY são obrigatórios para upload de arquivos.");
  }
  return { uploadUrl, apiKey };
}

function extractUrlFromJson(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  if (typeof o.url === "string" && o.url.startsWith("http")) return o.url;
  if (typeof o.secure_url === "string" && o.secure_url.startsWith("http")) return o.secure_url;
  if (typeof o.location === "string" && o.location.startsWith("http")) return o.location;
  if (o.data && typeof o.data === "object" && o.data !== null) {
    const d = o.data as Record<string, unknown>;
    if (typeof d.url === "string" && d.url.startsWith("http")) return d.url;
    if (typeof d.secure_url === "string" && d.secure_url.startsWith("http")) return d.secure_url;
  }
  return null;
}

function extractPublicIdFromJson(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  if (typeof o.public_id === "string") return o.public_id;
  if (typeof o.id === "string") return o.id;
  if (o.data && typeof o.data === "object" && o.data !== null) {
    const d = o.data as Record<string, unknown>;
    if (typeof d.id === "string") return d.id;
    if (typeof d.public_id === "string") return d.public_id;
  }
  return null;
}

/**
 * Envia o arquivo para APIMG (servidor → API). A chave não vai ao browser.
 * Ajuste de contrato: multipart com campo `file`; resposta JSON com URL pública.
 */
export async function uploadFileToApimg(
  file: Blob,
  filename: string,
  options?: { folder?: string }
): Promise<{ url: string; publicId: string }> {
  const { uploadUrl, apiKey } = getApimgConfig();
  const form = new FormData();
  form.append("file", file, filename);
  if (options?.folder) {
    form.append("folder", options.folder);
  }

  const authMode = process.env.APIMG_AUTH_MODE?.trim().toLowerCase();
  const headers: Record<string, string> =
    authMode === "x-api-key" ? { "X-API-Key": apiKey } : { Authorization: `Bearer ${apiKey}` };

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = { message: text.slice(0, 500) };
  }

  let url = extractUrlFromJson(body);
  if (!url && res.ok) {
    const t = text.trim();
    if (t.startsWith("http")) url = t;
  }
  if (!res.ok || !url) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message?: unknown }).message)
        : typeof body === "object" && body !== null && "error" in body
          ? String((body as { error?: unknown }).error)
          : text.slice(0, 200);
    throw new Error(msg || `Upload falhou (HTTP ${res.status}).`);
  }

  const publicId = extractPublicIdFromJson(body) ?? `apimg:${randomUUID()}`;
  return { url, publicId };
}
