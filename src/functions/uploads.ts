import { randomUUID } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAnyIdentity } from "@/server/auth/guard";
import { createUploadUrl } from "@/server/storage/r2";
import { getUploadPolicy } from "@/server/uploads/policy";
import { signUploadToken } from "@/server/uploads/uploadToken";

const requestSchema = z.object({
  purpose: z.enum(["assignment", "material", "library", "video", "slide"]),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  size: z.number().int().positive(),
});

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-180);
}

/**
 * Autoriza e devolve uma URL de upload direto pro R2 (o navegador nunca
 * manda o arquivo pro nosso servidor). Política (tipo/tamanho/quem pode) é
 * decidida aqui, igual antes com o Vercel Blob — só a forma de emitir a
 * autorização mudou (URL pré-assinada em vez de token do SDK do Blob).
 */
export const createUploadUrlFn = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const policy = getUploadPolicy(data.purpose);
    const identity = await requireAnyIdentity();
    if (policy.requiresTeacher && identity.role !== "teacher") {
      throw new Error("Ação restrita a professores.");
    }

    if (!policy.allowedContentTypes.includes(data.contentType)) {
      throw new Error("Tipo de arquivo não permitido.");
    }
    if (data.size > policy.maximumSizeInBytes) {
      throw new Error("Arquivo excede o tamanho máximo permitido.");
    }

    const key = `${data.purpose}/${randomUUID()}-${sanitizeFileName(data.fileName)}`;
    const uploadUrl = await createUploadUrl({
      key,
      contentType: data.contentType,
      contentLength: data.size,
    });
    const uploadToken = signUploadToken({
      identityId: identity.id,
      purpose: data.purpose,
      key,
    });

    return { uploadUrl, pathname: key, uploadToken };
  });
