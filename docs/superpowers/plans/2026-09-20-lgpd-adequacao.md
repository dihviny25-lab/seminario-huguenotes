# Adequação LGPD do Seminário Huguenotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adequar o tratamento de dados pessoais confirmado na auditoria, começando pelo bloqueio de exposição pública e entregando direitos, transparência, controle de dados sensíveis e minimização sem destruir histórico sem regra aprovada.

**Architecture:** O trabalho separa proteção de arquivos, ciclo de vida do titular, consentimento específico de reflexão, transparência geral e saneamento. O modelo relacional continua em Neon/Drizzle; novas rotas e funções reutilizam os guards de aluno, professor e administrador existentes. Toda operação de privacidade usa registros próprios, sem registrar conteúdo de titular no log operacional.

**Tech Stack:** TanStack Start/Router, React, TypeScript, Drizzle ORM, Neon Postgres, Vercel Blob, Vitest, ESLint, Prettier e Vite.

**Spec:** `docs/superpowers/specs/2026-09-20-lgpd-adequacao.md`

## Global Constraints

- Executar somente uma tarefa desta lista após aprovação explícita de Diego; parar ao final da tarefa aprovada.
- Não adicionar CPF neste plano nem usar CPF como atalho de busca de direitos.
- Nunca consultar conteúdo pessoal da produção para validar a implementação; usar banco descartável/fixtures.
- Nunca exportar hash de senha, tokens de recuperação/confirmação, token de calendário, inscrição/chaves de push ou segredos de sessão.
- Não publicar política com identidade do controlador, contato do encarregado, base legal ou prazo de retenção inventados.
- Não registrar IP no aceite padrão; o requisito mínimo é data, hora, versão e contexto.
- Não executar `pnpm db:push` em produção sem migration revisada, backup verificado, PR aprovado e autorização explícita.
- Não enviar arquivo privado para o Google Docs Viewer nem manter entrega de aluno em URL pública.
- Tratar cada texto livre como potencial dado pessoal; reflexão espiritual exige consentimento específico antes da primeira gravação.

## Review Focus

- URL pública antiga de arquivo de tarefa: depois da migração, deve ser revogada ou inacessível mesmo fora de sessão.
- Aluno autenticado tentando abrir arquivo de outro aluno: a rota deve responder sem conteúdo e sem revelar se o recurso existe.
- E-mail repetido entre alunos ou entre aluno/professor: a busca de direitos deve exigir escolha explícita, nunca exportar todos automaticamente.
- Pedido de exclusão com categoria sem retenção configurada: a operação deve parar e mostrar o bloqueio, sem apagar dados em cascata.
- Retirada do consentimento de reflexão: novas reflexões e comentários devem ficar bloqueados; conteúdo e identificadores devem seguir a ação aprovada no pedido de exclusão.

---

## Estrutura de arquivos prevista

| Caminho | Responsabilidade |
| --- | --- |
| `src/server/db/schema.ts` | Novas tabelas e colunas de privacidade; remoção posterior de campos excessivos. |
| `src/server/db/migrations/0002_privacy_foundation.sql` | Migration versionada para tabelas de arquivos privados, pedidos e regras de retenção. |
| `src/server/files/access.ts` | Autorização centralizada de leitura/download de arquivo por titular, professor ou administrador. |
| `src/functions/privateFiles.ts` | Funções de dados para resolver arquivo privado e solicitar URL/stream autorizado. |
| `src/routes/api/arquivo/$fileId.tsx` | Endpoint autenticado que entrega arquivo somente após `canReadPrivateFile`. |
| `src/server/privacy/export.ts` | Coleta estruturada e sanitizada de todos os dados de um titular. |
| `src/server/privacy/deletion.ts` | Plano e execução transacional de exclusão/anonimização por categoria. |
| `src/functions/privacyRequests.ts` | Busca, criação, exportação e execução de pedidos por administrador. |
| `src/pages/painel/PrivacyRequests.tsx` e `src/routes/painel/privacidade.tsx` | Console administrativo de direitos. |
| `src/server/privacy/acknowledgements.ts` | Registro e consulta de ciência/consentimento por versão/contexto. |
| `src/components/privacy/*` | Avisos de finalidade, diálogo de ciência e consentimento destacado de reflexão. |
| `src/pages/PrivacyPolicy.tsx`, `src/pages/PrivacyContact.tsx`, `src/routes/privacidade.tsx`, `src/routes/contato-privacidade.tsx` | Política versionada e canal de contato, apenas após dados do controlador. |
| `src/server/privacy/recipients.ts` | Registro versionado de fornecedores/dados/localidade confirmada e lacunas. |
| Arquivos de teste em `src/server/files`, `src/server/privacy` e `src/functions` | Cobertura de autorização, exportação, anonimização, consentimento e minimização. |

## Task 1: Conter arquivos públicos e visualização externa

**Files:**
- Create: `src/server/files/access.ts`
- Create: `src/server/files/access.test.ts`
- Create: `src/functions/privateFiles.ts`
- Create: `src/routes/api/arquivo/$fileId.tsx`
- Create: `src/server/db/migrations/0002_private_files.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/lib/blobUpload.ts`
- Modify: `src/routes/api/blob/upload.tsx`
- Modify: `src/lib/documentViewer.ts`
- Modify: `src/functions/assignmentSubmissions.ts`
- Modify: `src/functions/readingMaterials.ts`
- Modify: `src/functions/library.ts`
- Modify: `src/functions/presentationSlides.ts`
- Modify: `src/functions/videoLessons.ts`
- Modify: consumidores de `fileUrl` em `src/pages/portal` e `src/pages/painel`

**Interfaces:**
- Produces `canReadPrivateFile(input: { fileId: string; identity: AnyIdentity }): Promise<boolean>` em `src/server/files/access.ts`, usando o tipo já existente em `src/server/auth/guard.ts`.
- Produces `getPrivateFileAccessFn({ data: { fileId: string } }): Promise<{ url: string; expiresAt: string }>` em `src/functions/privateFiles.ts`.
- Consumes os guards existentes de `src/server/auth/guard.ts` e os vínculos já existentes de tarefas, materiais, livros, slides e vídeos.

- [ ] **Step 1: Acrescentar teste de autorização puro antes da rota**

```ts
import { describe, expect, it } from "vitest";
import { canReadFileRecord } from "./access";

describe("canReadFileRecord", () => {
  const assignment = { ownerType: "assignment_submission" as const, studentId: "student-a" };

  it("permite a entrega ao próprio aluno", () => {
    expect(canReadFileRecord(assignment, { role: "student", id: "student-a" })).toBe(true);
  });

  it("nega a entrega a outro aluno", () => {
    expect(canReadFileRecord(assignment, { role: "student", id: "student-b" })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha inicial**

Run: `pnpm test -- src/server/files/access.test.ts`
Expected: FAIL porque `access.ts` ainda não existe.

- [ ] **Step 3: Criar modelo de referência de arquivo privado**

Adicionar `private_files` com `id`, `blob_path`, `original_name`, `content_type`, `owner_type`, `owner_id`, `created_at` e `deleted_at`; migrar referências de URL de tarefa, material, biblioteca, slide e vídeo para `file_id` anulável sem apagar dados antigos na mesma migration. A migration deve copiar apenas a chave/URL como referência legada e marcar a revisão manual dos blobs antigos; não pode apagar objetos em lote.

- [ ] **Step 4: Implementar autorização central**

`canReadFileRecord` deve aceitar o próprio aluno apenas para `assignment_submission` vinculado ao seu `studentId`; docentes/admins seguem as permissões de leitura já aplicadas às respectivas telas. Recursos inexistentes e sem permissão devem resultar em `false` sem diferença observável no endpoint.

- [ ] **Step 5: Alterar upload e leitura**

Trocar `access: "public"` de `src/lib/blobUpload.ts` por armazenamento privado compatível com a versão de `@vercel/blob`; guardar `blob_path`/`file_id`, não uma URL pública como fonte de autorização. A rota `/api/arquivo/$fileId` deve exigir identidade, chamar `canReadPrivateFile` e entregar uma URL de curta duração ou stream do Blob. `getEmbeddableViewerUrl` deve deixar de construir `docs.google.com/gview`; Word/PowerPoint devem ser baixados/autorizados ou convertidos a PDF antes de visualização interna.

- [ ] **Step 6: Cobrir rota e URLs antigas**

Criar teste de integração com um registro de tarefa de `student-a`, chamando a função/handler com `student-b`; esperar `403` ou `404` sem URL. Criar teste para recurso legado: enquanto `file_id` for nulo, a tela deve exibir “arquivo indisponível para migração” para usuário comum, nunca o `fileUrl` legado.

- [ ] **Step 7: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/files/access.test.ts src/server/uploads/policy.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 8: Preparar plano de migração de blobs para revisão**

Listar somente metadados de URLs legadas por tipo e quantidade em ambiente não produtivo; gerar relatório de itens migrados/falhos sem expor URL ou nome de aluno em logs. Não apagar Blob antigo antes de validação administrativa.

- [ ] **Step 9: Commit**

```bash
git add src/server/db src/server/files src/functions/privateFiles.ts src/routes/api/arquivo src/lib/blobUpload.ts src/lib/documentViewer.ts src/functions src/pages
git commit -m "feat: protege arquivos privados por autorização"
```

## Task 2: Direitos do titular e exclusão sem cascata destrutiva

**Files:**
- Create: `src/server/privacy/export.ts`
- Create: `src/server/privacy/export.test.ts`
- Create: `src/server/privacy/deletion.ts`
- Create: `src/server/privacy/deletion.test.ts`
- Create: `src/functions/privacyRequests.ts`
- Create: `src/pages/painel/PrivacyRequests.tsx`
- Create: `src/routes/painel/privacidade.tsx`
- Create: `src/server/db/migrations/0003_privacy_requests.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/functions/students.ts`
- Modify: `src/components/painel/PainelShell.tsx`

**Interfaces:**
- Produces `findPrivacySubjectsByEmail(email: string): Promise<PrivacySubjectCandidate[]>`.
- Produces `buildSubjectExport(subject: PrivacySubjectRef): Promise<SubjectExport>`.
- Produces `planDeletion(subject: PrivacySubjectRef, retention: RetentionRule[]): Promise<DeletionPlan>` e `executeDeletion(planId: string): Promise<DeletionResult>`.
- `PrivacySubjectRef` deve conter `subjectType: "student" | "teacher"` e `subjectId: string`; e-mail nunca é a chave final de execução.

- [ ] **Step 1: Escrever testes de resolução por e-mail duplicado**

```ts
it("devolve dois candidatos quando o e-mail pertence a dois alunos", async () => {
  const candidates = await findPrivacySubjectsByEmail("familia@example.com");
  expect(candidates).toHaveLength(2);
  expect(candidates.map((item) => item.emailMasked)).toEqual(["f***@example.com", "f***@example.com"]);
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `pnpm test -- src/server/privacy/export.test.ts`
Expected: FAIL porque o módulo de direitos ainda não existe.

- [ ] **Step 3: Criar tabelas de pedido e retenção**

Criar `privacy_requests` com `id`, `subject_type`, `subject_id`, `request_type` (`export` ou `deletion`), `status`, `requested_by_id`, `created_at`, `completed_at` e `result_summary`; criar `retention_rules` com `data_category`, `action` (`delete` ou `anonymize`), `legal_reason`, `retention_until` e `active`. A migration inicia sem regra de retenção ativa; portanto exclusão fica bloqueada até configuração aprovada.

- [ ] **Step 4: Implementar exportação sanitizada e completa**

`buildSubjectExport` deve consultar, por `subjectId`, cadastro, relações acadêmicas, cobranças, tarefas, provas, frequência, vídeos, fóruns, anotações, reflexões, comentários, observações, push, logs e arquivos. O resultado deve separar dados próprios, dados derivados e metadados de arquivo. Remover explicitamente os campos secretos definidos em Global Constraints antes de serializar `dados.json`.

- [ ] **Step 5: Escrever teste de exclusão de segredo**

```ts
it("não inclui credenciais nem tokens no arquivo do titular", async () => {
  const data = await buildSubjectExport({ subjectType: "student", subjectId: "student-a" });
  expect(JSON.stringify(data)).not.toContain("password_hash");
  expect(JSON.stringify(data)).not.toContain("calendarToken");
  expect(JSON.stringify(data)).not.toContain("resetToken");
});
```

- [ ] **Step 6: Implementar plano de exclusão e substituir DELETE direto**

`planDeletion` deve classificar cada categoria em `delete`, `anonymize` ou `blocked_missing_retention_rule`. `executeDeletion` só executa plano sem bloqueios, revoga acesso/tokens/push/agenda, remove blobs autorizados e aplica anonimização a registros cuja regra ativa assim exigir. Substituir `deleteStudentFn` por criação de pedido: a tela de alunos não pode mais chamar `db.delete(students)`.

- [ ] **Step 7: Criar tela administrativa**

Adicionar menu “Privacidade” apenas para `admin`. A tela busca por e-mail, apresenta candidatos mascarados, exige seleção, cria pedido de exportação ou exclusão, mostra categorias e bloqueios, e permite baixar resultado temporário. Não permitir busca por CPF enquanto o campo não existir.

- [ ] **Step 8: Testar cascata e regra ausente**

```ts
it("não deleta aluno quando falta regra de retenção", async () => {
  const plan = await planDeletion({ subjectType: "student", subjectId: "student-a" }, []);
  expect(plan.blockedCategories).toContain("academic_history");
  await expect(executeDeletion(plan.id)).rejects.toThrow("retenção");
});
```

- [ ] **Step 9: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/privacy/export.test.ts src/server/privacy/deletion.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 10: Commit**

```bash
git add src/server/privacy src/functions/privacyRequests.ts src/pages/painel/PrivacyRequests.tsx src/routes/painel/privacidade.tsx src/functions/students.ts src/server/db
git commit -m "feat: adiciona direitos e exclusão controlada"
```

## Task 3: Reflexões espirituais, observações e consentimento específico

**Files:**
- Create: `src/server/privacy/acknowledgements.ts`
- Create: `src/server/privacy/acknowledgements.test.ts`
- Create: `src/components/privacy/ReflectionConsentDialog.tsx`
- Create: `src/server/db/migrations/0004_reflection_consent.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/functions/reflections.ts`
- Modify: `src/functions/observations.ts`
- Modify: `src/pages/portal/discipulado.tsx`
- Modify: `src/pages/painel/reports/StudentReport.tsx`
- Modify: `src/server/push.ts`

**Interfaces:**
- Produces `recordAcknowledgement(input: { subjectType; subjectId; policyVersion; context; acceptedAt? }): Promise<void>`.
- Produces `hasActiveAcknowledgement(input: { subjectType; subjectId; policyVersion; context }): Promise<boolean>`.
- Produces `revokeAcknowledgement(input: { subjectType; subjectId; context }): Promise<void>`.
- Contexto da reflexão: `reflection_sensitive_data`.
- Pré-condição: o controlador aprovou, por escrito, a versão do aviso específico e a lista de docentes que poderá ler/comentar reflexões.

- [ ] **Step 1: Criar teste de bloqueio sem consentimento**

```ts
it("recusa gravar reflexão sem consentimento específico ativo", async () => {
  await expect(createReflectionAsStudent("student-a", "texto pessoal")).rejects.toThrow(
    "consentimento específico",
  );
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `pnpm test -- src/server/privacy/acknowledgements.test.ts`
Expected: FAIL porque não há tabela ou verificação de consentimento.

- [ ] **Step 3: Criar registro versionado e revogável**

Criar `privacy_acknowledgements` com `id`, `subject_type`, `subject_id`, `policy_version`, `context`, `accepted_at`, `revoked_at` e `recorded_by_id`. O timestamp é sempre do servidor. `context` diferencia ciência geral de consentimento de reflexão.

- [ ] **Step 4: Aplicar diálogo antes da primeira reflexão**

O diálogo deve exibir exatamente a finalidade confirmada na especificação, informar que a reflexão é voluntária e que professores logados a veem/comentam no estado atual, exigir seleção explícita e registrar versão/horário. Sem aceite, `createReflectionFn` não faz insert.

- [ ] **Step 5: Reduzir exposição secundária**

`sendPushToOwner` não deve receber título/corpo com trecho de reflexão ou observação. Manter notificação genérica, por exemplo `“Há uma atualização no seu acompanhamento”`, sem texto sensível.

- [ ] **Step 6: Avisar ao registrar observação**

Na área de observações do relatório, inserir o texto aprovado na especificação e validação de interface que exige confirmação do professor antes de gravar conteúdo. A confirmação não substitui consentimento do aluno e não cria nova categoria de dado.

- [ ] **Step 7: Cobrir revogação**

```ts
it("não considera ativo consentimento revogado", async () => {
  await revokeAcknowledgement({ subjectType: "student", subjectId: "student-a", context: "reflection_sensitive_data" });
  await expect(hasActiveAcknowledgement({ subjectType: "student", subjectId: "student-a", policyVersion: "reflection-v1", context: "reflection_sensitive_data" })).resolves.toBe(false);
});
```

- [ ] **Step 8: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/privacy/acknowledgements.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add src/server/privacy src/components/privacy src/functions/reflections.ts src/functions/observations.ts src/pages/portal/discipulado.tsx src/pages/painel/reports/StudentReport.tsx src/server/push.ts src/server/db
git commit -m "feat: protege reflexões como dado sensível"
```

## Task 4: Política factual, finalidades e ciência versionada

**Files:**
- Create: `src/server/privacy/policy.ts`
- Create: `src/server/privacy/policy.test.ts`
- Create: `src/components/privacy/PrivacyNotice.tsx`
- Create: `src/components/privacy/PolicyAcceptanceDialog.tsx`
- Create: `src/pages/PrivacyPolicy.tsx`
- Create: `src/pages/PrivacyContact.tsx`
- Create: `src/routes/privacidade.tsx`
- Create: `src/routes/contato-privacidade.tsx`
- Modify: `src/functions/studentAuth.ts`
- Modify: `src/functions/auth.ts`
- Modify: `src/pages/painel/Students.tsx`
- Modify: `src/pages/painel/TeacherAccounts.tsx`
- Modify: `src/pages/portal/PortalAccount.tsx`
- Modify: telas de tarefa, fórum, pagamento, push e agenda listadas na especificação

**Interfaces:**
- Produces `ACTIVE_POLICY: { version: string; publishedAt: string; controllerName: string; privacyContact: string }` somente quando todos os campos obrigatórios forem informados pelo controlador.
- Produces `requiresPolicyAcknowledgement(subject): Promise<boolean>` e `recordPolicyAcknowledgement(subject): Promise<void>`.
- Produces `validatePolicyConfig(input: ActivePolicyConfig): ActivePolicyConfig` antes de a rota pública renderizar o texto.

- [ ] **Step 1: Bloquear publicação sem dados obrigatórios do controlador**

```ts
it("não publica política sem controlador e canal de privacidade", () => {
  expect(() => validatePolicyConfig({ version: "2026-09-20", controllerName: "", privacyContact: "" })).toThrow(
    "controlador",
  );
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `pnpm test -- src/server/privacy/policy.test.ts`
Expected: FAIL porque a configuração e validação não existem.

- [ ] **Step 3: Receber e versionar somente fatos aprovados**

Antes do código de página, obter os seis itens humanos da especificação. Escrever política com as finalidades, categorias, destinatários e lacunas confirmadas, sem declarar retenção, país ou base legal ainda não aprovados. Versionar texto e data de vigência no mesmo módulo.

- [ ] **Step 4: Implementar política e canal**

Criar `/privacidade` com política completa e versão; criar `/contato-privacidade` com o canal aprovado e formulário mínimo que pede e-mail, tipo de solicitação e descrição opcional. O formulário deve criar pedido de privacidade, não e-mail não rastreável.

- [ ] **Step 5: Implementar ciência no primeiro acesso**

Após autenticação bem-sucedida de aluno/professor, mostrar diálogo bloqueante apenas se não houver registro ativo para `policy_general`. Registrar data/hora do servidor, versão e contexto `first_access`. Login, recuperação e confirmação de e-mail exibem link de política, mas recuperação não exige checkbox.

- [ ] **Step 6: Inserir avisos nas telas confirmadas**

Usar `PrivacyNotice` com os textos exatos da especificação em: criação/importação de aluno, conta de professor, Minha conta, tarefa, fórum, observação, cobrança, push e agenda. Cadastro por administrador grava contexto `administrative_collection_notice`; não registra falsamente aceite do titular.

- [ ] **Step 7: Cobrir uma versão nova da política**

```ts
it("solicita nova ciência quando a versão ativa muda", async () => {
  await recordAcknowledgement({ subjectType: "student", subjectId: "student-a", policyVersion: "2026-09-20", context: "policy_general" });
  await expect(requiresPolicyAcknowledgement({ subjectType: "student", subjectId: "student-a", activeVersion: "2026-10-01" })).resolves.toBe(true);
});
```

- [ ] **Step 8: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/privacy/policy.test.ts src/server/privacy/acknowledgements.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add src/server/privacy src/components/privacy src/pages/PrivacyPolicy.tsx src/pages/PrivacyContact.tsx src/routes/privacidade.tsx src/routes/contato-privacidade.tsx src/functions src/pages
git commit -m "feat: adiciona política e ciência versionada"
```

## Task 5: Registro de destinatários, avisos externos e configurações

**Files:**
- Create: `src/server/privacy/recipients.ts`
- Create: `src/server/privacy/recipients.test.ts`
- Modify: `src/components/portal/CalendarSyncCard.tsx`
- Modify: `src/components/NotificationToggle.tsx`
- Modify: `src/components/WhatsappButton.tsx`
- Modify: `src/lib/documentViewer.ts`
- Modify: `docs/superpowers/specs/2026-09-20-lgpd-adequacao.md`

**Interfaces:**
- Produces `listRecipientDisclosures(): RecipientDisclosure[]` com `name`, `dataCategories`, `countryStatus`, `country`, `outsideBrazil`, `evidence`.
- Produces `recipientDisclosure(input: Pick<RecipientDisclosure, "name" | "countryStatus" | "country">): RecipientDisclosure` para normalizar a saída pública.
- `countryStatus` só aceita `confirmed` ou `not_confirmed`; `outsideBrazil` só é `true` quando `countryStatus === "confirmed"` e o país não é Brasil.

- [ ] **Step 1: Escrever teste contra inferência de país**

```ts
it("não marca fornecedor como fora do Brasil sem país confirmado", () => {
  const disclosure = recipientDisclosure({ name: "Mercado Pago", countryStatus: "not_confirmed" });
  expect(disclosure.outsideBrazil).toBe(false);
  expect(disclosure.country).toBe("Não confirmado");
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `pnpm test -- src/server/privacy/recipients.test.ts`
Expected: FAIL porque não existe o registro de destinatários.

- [ ] **Step 3: Codificar somente evidências confirmadas**

Registrar Neon/Ohio-EUA e Resend/EUA como confirmados. Registrar Vercel Blob/hospedagem, Mercado Pago, push, Google e WhatsApp como não confirmados até a revisão contratual. Não criar afirmação de país a partir de domínio ou sede empresarial.

- [ ] **Step 4: Exibir avisos no momento da transferência**

Agenda deve explicar que o link-capacidade, nome do calendário e eventos são fornecidos a Google/Outlook/Apple quando o aluno assina. Push deve explicar inscrição do dispositivo. WhatsApp deve exibir aviso curto antes de abrir link com mensagem contextual. O Viewer externo permanece desativado pela Task 1.

- [ ] **Step 5: Atualizar a especificação após cada confirmação externa**

Quando contrato/DPA/configuração for revisado, atualizar a tabela de destinatários e a seção correspondente da especificação com documento, data da confirmação e país. Não mudar a política sem criar nova versão e exigir ciência conforme Task 4.

- [ ] **Step 6: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/privacy/recipients.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/server/privacy/recipients.ts src/server/privacy/recipients.test.ts src/components/portal/CalendarSyncCard.tsx src/components/NotificationToggle.tsx src/components/WhatsappButton.tsx docs/superpowers/specs/2026-09-20-lgpd-adequacao.md
git commit -m "docs: registra destinatários e avisos de transferência"
```

## Task 6: Minimizar campos sem uso e corrigir auditoria

**Files:**
- Create: `src/server/privacy/minimization.test.ts`
- Create: `src/server/db/migrations/0005_minimize_personal_data.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/functions/payments.ts`
- Modify: `src/server/audit.ts`
- Modify: `src/functions/auditLog.ts`
- Modify: `src/pages/painel/AuditLog.tsx`
- Modify: `src/functions/studentAuth.ts`
- Modify: `src/pages/portal/PortalAccount.tsx`

**Interfaces:**
- Audit sessions must group by `{ actorType, actorId }`, never by `{ actorType, actorName }`.
- Payment checkout result returned to the client remains `{ initPoint: string }`; it is not persisted in `charges` after redirect creation.
- Produces `buildAuditSessions(rows: AuditLogRow[]): AuditSession[]` como função pura exportada de `src/functions/auditLog.ts`.

- [ ] **Step 1: Criar teste de colisão de nome na auditoria**

```ts
it("não mistura sessões de pessoas com o mesmo nome", () => {
  const sessions = buildAuditSessions([
    { actorType: "student", actorId: "a", actorName: "João", action: "login", createdAt: new Date("2026-01-01T10:00:00Z") },
    { actorType: "student", actorId: "b", actorName: "João", action: "login", createdAt: new Date("2026-01-01T11:00:00Z") },
  ]);
  expect(sessions).toHaveLength(2);
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `pnpm test -- src/server/privacy/minimization.test.ts`
Expected: FAIL porque o agrupamento atual usa nome + tipo.

- [ ] **Step 3: Remover persistência sem leitura de checkout**

Alterar `payChargeFn` para devolver `initPoint` diretamente ao portal e remover gravação de `mpPreferenceId`/`mpInitPoint`. A migration remove as duas colunas apenas depois de validar que não há rotina de reconciliação dependente delas.

- [ ] **Step 4: Corrigir uso de `actorId`**

Modificar `buildAuditSessions`, filtros e tipos do retorno para manter `actorId` interno; a interface pode continuar exibindo nome, mas a chave e a filtragem por sujeito devem usar ID. Não apagar `actorId`.

- [ ] **Step 5: Remover ou justificar datas de criação de conta**

Antes de dropar `students.createdAt` e `teachers.createdAt`, acrescentar consulta de dependência no banco e confirmar que nenhum relatório/exportação precisa delas. Se permanecerem para auditoria, criar tela/propósito que as lê e atualizar a política; se não, remover colunas em migration separada.

- [ ] **Step 6: Suspender solicitação sem finalidade de nascimento**

Enquanto não houver finalidade aprovada, tornar data de nascimento ausente da interface `Minha conta` e não incluí-la em `updateMyStudentProfileFn`; não apagar valores existentes até que a Task 2 tenha regra de exclusão/anonimização aprovada.

- [ ] **Step 7: Executar verificação completa da tarefa**

Run: `pnpm test -- src/server/privacy/minimization.test.ts src/lib/payments.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/server/db src/server/privacy/minimization.test.ts src/functions/payments.ts src/server/audit.ts src/functions/auditLog.ts src/pages/painel/AuditLog.tsx src/functions/studentAuth.ts src/pages/portal/PortalAccount.tsx
git commit -m "refactor: minimiza dados pessoais sem uso"
```

## Task 7: CPF — fora do escopo até decisão formal

**Files:** Nenhum arquivo deve ser criado nesta tarefa.

- [ ] **Step 1: Registrar a decisão necessária antes de qualquer código**

Documento obrigatório do controlador: finalidade concreta, base legal, obrigatoriedade, pessoas alcançadas, origem do CPF, prazo de retenção, pessoas com acesso, operador que recebe CPF e mecanismo de busca/mascaramento.

- [ ] **Step 2: Encerrar sem alteração de esquema**

Enquanto não houver o documento acima aprovado, não adicionar coluna, importação, máscara, índice, formulário ou busca por CPF. A rotina de direitos usa e-mail e seleção de candidato conforme Task 2.

## Self-review

### Cobertura da especificação

- Exposição de Blob e Google Docs Viewer: Task 1.
- Exportação, exclusão/anonimização e console administrativo: Task 2.
- Reflexão religiosa, observação e push: Task 3.
- Textos por tela, política, canal e ciência versionada: Task 4.
- Destinatários, países confirmados e avisos de transferência: Task 5.
- Campos excessivos, `actorId`, datas de criação e nascimento: Task 6.
- CPF futuro e condicionado: Task 7.

### Testes de foco

- URLs antigas, acesso cruzado e arquivo legado: Task 1.
- E-mail duplicado, segredos na exportação e retenção ausente: Task 2.
- Consentimento ausente/revogado e notificação sem conteúdo sensível: Task 3.
- Troca de versão da política e falta de dados do controlador: Task 4.
- País não confirmado e aviso de fornecedor: Task 5.

### Consistência de interfaces

- `PrivacySubjectRef` é a chave final de exportação/eliminação em Task 2.
- `privacy_acknowledgements` criado na Task 3 é reutilizado pelas funções de ciência da Task 4.
- `canReadPrivateFile` da Task 1 é a única decisão de leitura de anexos privados.
- `actorId` deixa de ser dado morto na Task 6 e nunca é removido nessa tarefa.

## Execution Handoff

Plano salvo em `docs/superpowers/plans/2026-09-20-lgpd-adequacao.md`. Ele depende da especificação em `docs/superpowers/specs/2026-09-20-lgpd-adequacao.md`.

O executor deve começar apenas pela tarefa que Diego aprovar explicitamente, abrir uma issue quando a entrega alterar comportamento/schema, trabalhar em branch e PR, e parar após terminar e validar essa tarefa. Nenhuma outra tarefa é autorização implícita de execução.
