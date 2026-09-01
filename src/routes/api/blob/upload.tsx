import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { requireAnyLogin, requireTeacherId } from "@/server/auth/guard";
import { getUploadPolicy, parseUploadPurpose } from "@/server/uploads/policy";

/** Emite token de upload direto pro Vercel Blob com política por finalidade. */
export const Route = createFileRoute("/api/blob/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as HandleUploadBody;

        try {
          const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (_pathname, clientPayload) => {
              const purpose = parseUploadPurpose(clientPayload);
              const policy = getUploadPolicy(purpose);

              if (policy.requiresTeacher) {
                await requireTeacherId();
              } else {
                await requireAnyLogin();
              }

              return {
                allowedContentTypes: policy.allowedContentTypes,
                addRandomSuffix: true,
                maximumSizeInBytes: policy.maximumSizeInBytes,
              };
            },
            onUploadCompleted: async () => {},
          });
          return Response.json(jsonResponse);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha no upload." },
            { status: 400 },
          );
        }
      },
    },
  },
});
