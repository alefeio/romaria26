const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
  "avi",
  "mkv",
]);

export function isVideoUrl(url: string): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw, "http://local.invalid");
    const path = u.pathname || "";
    const last = path.split("/").pop() || "";
    const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
    return VIDEO_EXTENSIONS.has(ext);
  } catch {
    const cleaned = raw.split("?")[0]?.split("#")[0] ?? raw;
    const last = cleaned.split("/").pop() || "";
    const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
    return VIDEO_EXTENSIONS.has(ext);
  }
}

