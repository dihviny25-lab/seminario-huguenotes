import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
} from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export type PushNotificationPayload = {
  title: string;
  body: string;
  /** Caminho relativo pra onde o clique na notificação deve levar (ex.: "/portal/provas"). */
  url: string;
};

/**
 * Manda a notificação pra todos os dispositivos inscritos de um professor ou
 * aluno. Nunca lança erro — falha ao enviar push não pode quebrar a ação
 * principal (lançar nota, responder no fórum, etc). Assinaturas que o
 * serviço de push recusa como inválidas (404/410 — usuário desinstalou o
 * PWA ou limpou os dados do navegador) são removidas do banco.
 */
export async function sendPushToOwner(
  ownerType: "teacher" | "student",
  ownerId: string,
  payload: PushNotificationPayload,
): Promise<void> {
  try {
    const vapid = getVapidKeys();
    if (!vapid) return;

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.ownerId, ownerId));
    const relevant = subs.filter((s) => s.ownerType === ownerType);
    if (relevant.length === 0) return;

    await Promise.all(
      relevant.map(async (sub) => {
        const subscription: WebPushSubscription = {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
        };
        try {
          const { headers, body } = await buildPushPayload(
            { data: { title: payload.title, body: payload.body, url: payload.url } },
            subscription,
            vapid,
          );
          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers,
            body: body as BodyInit,
          });
          if (response.status === 404 || response.status === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        } catch {
          // Uma inscrição com problema não pode impedir o envio pras outras.
        }
      }),
    );
  } catch {
    // Push é um extra — nunca pode quebrar a ação que está sendo notificada.
  }
}
