// Service worker mínimo, só para o app ser instalável como PWA.
//
// De propósito NÃO faz cache de páginas, dados ou chamadas de API: este é
// um sistema com login (professores e alunos) e notas/faltas em tempo
// real — cachear isso arriscaria mostrar informação errada ou desatualizada
// offline. Tudo aqui continua indo direto pra rede.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Sem listener de "fetch" — o navegador trata cada requisição normalmente,
// como se não houvesse service worker nenhum no meio do caminho.

self.addEventListener("push", (event) => {
  let payload = { title: "Seminário Huguenotes", body: "Você tem uma notificação nova.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload inesperado (não-JSON) — usa o texto puro como corpo da notificação.
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
