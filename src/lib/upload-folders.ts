/** Prefixo lógico de pasta (enviado à API de upload se ela suportar o campo `folder`). */
const SITE_UPLOAD_PREFIX = "igh/site";
const DEFAULT_STUDENTS_BASE = "igh/students";

/** Pasta para arquivos do cliente (área logada): base/customers/userId */
export function getCustomerUploadFolder(userId: string): string {
  const base = process.env.APIMG_UPLOAD_FOLDER?.trim() || DEFAULT_STUDENTS_BASE;
  return `${base}/customers/${userId}`.replace(/\/+/g, "/");
}

/**
 * Folder para certificado de matrícula: base/enrollments/enrollmentId
 */
export function getEnrollmentCertificateFolder(enrollmentId: string): string {
  const base = process.env.APIMG_UPLOAD_FOLDER?.trim() || DEFAULT_STUDENTS_BASE;
  return `${base}/enrollments/${enrollmentId}`.replace(/\/+/g, "/");
}

export function getSiteUploadFolder(
  kind:
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
    | "packages"
): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}`.replace(/\/+/g, "/");
}

export function getSiteUploadFolderWithId(kind: "banners" | "projects" | "news" | "transparency", id: string): string {
  return `${SITE_UPLOAD_PREFIX}/${kind}/${id}`.replace(/\/+/g, "/");
}

/** Pasta para anexos de chamados de suporte: base/support/{userId} */
export function getSupportUploadFolder(userId: string): string {
  const base = process.env.APIMG_UPLOAD_FOLDER?.trim() || "igh";
  return `${base}/support/${userId}`.replace(/\/+/g, "/");
}
