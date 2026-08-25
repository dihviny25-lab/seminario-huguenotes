import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAnyIdentity } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";

/** Chave pública VAPID — o cliente usa pra chamar `pushManager.subscribe()`. */
export const getVapidPublicKeyFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<string | null> => {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  },
);

const subscribeSchema = z.object({
  endpoint: z.string().trim().url(),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
});

/** Salva (ou atualiza, se o endpoint já existir) a inscrição de push deste dispositivo. */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator(subscribeSchema)
  .handler(async ({ data }) => {
    const identity = await requireAnyIdentity();
    await db
      .insert(pushSubscriptions)
      .values({
        ownerType: identity.role,
        ownerId: identity.id,
        endpoint: data.endpoint,
        p256dhKey: data.keys.p256dh,
        authKey: data.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          ownerType: identity.role,
          ownerId: identity.id,
          p256dhKey: data.keys.p256dh,
          authKey: data.keys.auth,
        },
      });
  });

const endpointSchema = z.object({ endpoint: z.string().trim().url() });

/** Remove a inscrição deste dispositivo (aluno/professor desativou as notificações). */
export const deletePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator(endpointSchema)
  .handler(async ({ data }) => {
    await requireAnyIdentity();
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint));
  });
