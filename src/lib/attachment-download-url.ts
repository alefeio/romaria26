/**
 * URL para abrir/baixar anexo. Ajustes legados para links antigos de hospedagem raw.
 */
export function attachmentUrlForDownload(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.includes("res.cloudinary.com") && url.includes("/raw/upload/")) {
    return url.replace(/(\/raw\/upload\/)(v\d+\/)/, "$1fl_attachment/$2");
  }
  return url;
}
