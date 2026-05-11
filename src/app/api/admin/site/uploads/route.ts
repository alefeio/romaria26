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

  const isVideo = file.type.startsWith("video/");
  const videoSub = process.env.APIMG_GALLERY_VIDEO_SUBFOLDER?.trim();
  if (kind === "gallery" && isVideo && videoSub) {
    folder = `${folder}/${videoSub}`.replace(/\/+/g, "/");
  }

  const uploadUrlVideo = process.env.APIMG_UPLOAD_URL_VIDEO?.trim();
  const uploadUrl =
    kind === "gallery" && isVideo && uploadUrlVideo ? uploadUrlVideo : undefined;

  try {
    const { url, publicId } = await uploadFileToApimg(file, file.name || "upload", {
      folder,
      uploadUrl,
    });
    return jsonOk({ url, publicId });
  } catch (e) {
    let message = e instanceof Error ? e.message : "Falha no upload.";
    if (/tipo não suportado|allowed_mime|mime/i.test(message)) {
      message +=
        " No serviço APIMG, inclua tipos video/* (ex.: video/mp4) em allowed_mime para este upload, ou defina APIMG_UPLOAD_URL_VIDEO no .env apontando para um endpoint que aceite vídeos. Opcional: APIMG_GALLERY_VIDEO_SUBFOLDER=video para usar subpasta com regras diferentes.";
    }
    return jsonErr("UPLOAD_ERROR", message, 502);
  }
}
