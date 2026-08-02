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
