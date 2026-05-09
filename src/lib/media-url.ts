const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
  "avi",
  "mkv",
]);

/**
 * Heurística para URL de arquivo de vídeo (upload direto / CDN).
 * Alguns hosts não expõem extensão no path; incluímos pistas comuns em query/path.
 */
export function isVideoUrl(url: string): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();

  if (/\/video\//.test(lower) || /\/videos\//.test(lower)) return true;
  if (/[?&](resource_type|type)=video\b/i.test(lower)) return true;
  if (/[?&]format=(mp4|webm|ogg|mov)\b/i.test(lower)) return true;

  // Extensão em qualquer parte da URL (path ou nome em query)
  if (/\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|#|$|&)/i.test(lower)) return true;

  try {
    const u = new URL(raw, "http://local.invalid");
    for (const key of ["filename", "file", "name", "key"]) {
      const v = u.searchParams.get(key);
      if (v && /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|#|$)/i.test(v.toLowerCase())) return true;
    }
    const path = u.pathname || "";
    const last = path.split("/").pop() || "";
    const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
    if (VIDEO_EXTENSIONS.has(ext)) return true;
  } catch {
    const cleaned = raw.split("?")[0]?.split("#")[0] ?? raw;
    const last = cleaned.split("/").pop() || "";
    const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
    return VIDEO_EXTENSIONS.has(ext);
  }

  return false;
}

export function isVideoMimeType(mime: string): boolean {
  return (mime ?? "").trim().toLowerCase().startsWith("video/");
}

