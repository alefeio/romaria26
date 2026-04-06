import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { uploadFileToApimg } from "@/lib/apimg";
import { getCustomerUploadFolder } from "@/lib/upload-folders";

/** Upload de arquivo pelo cliente logado (legado: rota /student). */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "CUSTOMER") {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonErr("INVALID_BODY", "FormData inválido.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonErr("VALIDATION_ERROR", "Arquivo (file) é obrigatório.", 400);
  }

  try {
    const folder = getCustomerUploadFolder(user.id);
    const result = await uploadFileToApimg(file, file.name || "anexo", { folder });
    return jsonOk(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha no upload.";
    return jsonErr("UPLOAD_ERROR", message, 502);
  }
}
