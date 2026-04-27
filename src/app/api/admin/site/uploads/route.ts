import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { uploadFileToApimg } from "@/lib/apimg";
import { getSiteUploadFolder, getSiteUploadFolderWithId } from "@/lib/upload-folders";
import { z } from "zod";

const kindSchema = z.enum([
  "logo",
  "favicon",
  "opengraph",
  "banners",
  "partners",
  "projects",
  "testimonials",
  "news",
  "transparency",
  "about",
  "contato",
  "packages",
  "gallery",
]);

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);

  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonErr("INVALID_BODY", "FormData inválido.", 400);
  }

  const file = form.get("file");
  const kindRaw = form.get("kind");
  const idRaw = form.get("id");

  if (!(file instanceof File) || file.size === 0) {
    return jsonErr("VALIDATION_ERROR", "Arquivo (file) é obrigatório.", 400);
  }

  const kindParsed = kindSchema.safeParse(typeof kindRaw === "string" ? kindRaw : "");
  if (!kindParsed.success) {
    return jsonErr("VALIDATION_ERROR", "Campo kind inválido.", 400);
  }
  const kind = kindParsed.data;

  const id = typeof idRaw === "string" && idRaw.length > 0 ? idRaw : undefined;
  const kindWithOptionalEntityId = ["banners", "projects", "news", "transparency", "gallery"] as const;
  if (kindWithOptionalEntityId.includes(kind as (typeof kindWithOptionalEntityId)[number])) {
    if (id && !z.string().uuid().safeParse(id).success) {
      return jsonErr("VALIDATION_ERROR", "id deve ser um UUID válido.", 400);
    }
  } else if (id) {
    return jsonErr("VALIDATION_ERROR", "id só é permitido para banners, projects, news, transparency ou gallery.", 400);
  }

  let folder: string;
  if (id && kindWithOptionalEntityId.includes(kind as (typeof kindWithOptionalEntityId)[number])) {
    folder = getSiteUploadFolderWithId(kind as "banners" | "projects" | "news" | "transparency" | "gallery", id);
  } else {
    folder = getSiteUploadFolder(kind);
  }

  try {
    const { url, publicId } = await uploadFileToApimg(file, file.name || "upload", { folder });
    return jsonOk({ url, publicId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no upload.";
    return jsonErr("UPLOAD_ERROR", message, 502);
  }
}
