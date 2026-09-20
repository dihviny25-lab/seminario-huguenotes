# Especificação técnica — adequação LGPD

Data da auditoria: 20/09/2026
Código auditado: `origin/main` no commit `6ba1bacde74fb588fdca8bfae237f4abcb618d85`
Banco auditado: metadados e contagens agregadas da produção Neon; nenhum conteúdo de titular foi lido.

## Fatos confirmados

- Não há CPF no código, nas importações ou no banco de produção. CPF é trabalho futuro condicionado a finalidade, base legal, retenção e proteção aprovadas; não é parte deste escopo.
- Não há política de privacidade, versão de política, aceite, canal do encarregado ou rotina de direitos no código funcional.
- A produção usa Neon na região AWS `us-east-2` (Ohio, EUA). Há aproximadamente 29 alunos, 9 professores, 264 cobranças, 642 presenças, 718 logs de auditoria, 26 entregas e 161 respostas de tarefa. Essas contagens são apenas evidência de escopo.
- O upload em `src/lib/blobUpload.ts` usa `access: "public"`. Arquivos de tarefas podem conter dados pessoais e são acessíveis pela URL pública.
- `src/lib/documentViewer.ts` envia URL pública de Word/PowerPoint ao Google Docs Viewer para renderização.
- A remoção em `src/functions/students.ts` apaga `students`; relações de notas, presenças, cobranças, tarefas, reflexões e anotações têm cascata no esquema atual.
- Reflexões espirituais podem revelar convicção religiosa. A função atual permite que qualquer professor autenticado as leia e comente.
- Não encontrei integração de IA ou analytics no código. Isso não prova ausência de logs ou suboperadores configurados fora do repositório.

## Mapa de dados pessoais

| Grupo de dados | Coleta/geração | Armazenamento | Uso real confirmado |
| --- | --- | --- | --- |
| Aluno: ID, nome, e-mail, telefone | Criação, edição e importação de alunos. A importação lê Nome, E-mail e Telefone/WhatsApp. | `students` | Login, recuperação/confirmação de e-mail, perfil, WhatsApp, cobranças, boletim, tarefas e demais relações acadêmicas. |
| Data de nascimento | O próprio aluno em `Minha conta`. | `students.birth_date` | Apenas exibida e editada pelo próprio aluno; não há cálculo, relatório ou regra operacional encontrada. Rever necessidade. |
| Bolsa e status ativo | Administração de alunos. | `students` | Bolsa altera a geração de mensalidades; status controla a listagem/uso do aluno. |
| Credenciais e autenticação | Login, redefinição/alteração de senha e confirmação de e-mail; tokens são gerados pelo sistema. | `students`, `teachers`, cookies de sessão | Autenticação, troca obrigatória, recuperação e confirmação. Hashes, tokens e chaves não entram na exportação do titular. |
| Agenda pessoal | Token gerado ao abrir `Agenda pessoal`. | `students.calendar_token` | Autoriza feed `.ics` por URL, sem sessão e sem expiração. |
| Professor: ID, nome, e-mail, papel e credenciais | Administração de contas, edição própria, login/recuperação. | `teachers` | Identificação, acesso, atribuição a disciplina/aula, autoria de conteúdos, fóruns, comentários e auditoria. |
| Dados acadêmicos | Lançamento docente, check-in, tarefas, provas e player de vídeo. | `grades`, `attendance`, `video_watches`, `exam_attempts`, `exam_answers`, `assignment_submissions`, `assignment_answers` | Boletim, médias, frequência, correção, feedback, relatórios e portal. |
| Entrega de tarefa | Texto e arquivo enviados por aluno; feedback docente. | `assignment_submissions` e Vercel Blob | Avaliação e apresentação no portal/painel. Arquivo/nome de arquivo podem conter dados pessoais. |
| Observação de aluno | Professor registra texto livre no boletim. | `student_observations` | Qualquer professor autenticado lê; o autor apaga apenas sua própria observação. |
| Reflexão espiritual e comentários | Aluno registra texto; professor comenta. | `spiritual_reflections`, `reflection_comments` | Acompanhamento espiritual no boletim. Pode conter dado sensível religioso. |
| Anotações e fórum de aluno | Aluno escreve anotação; pode publicar como dúvida; professor/aluno abre e responde fórum. | `student_notes`, `forum_threads`, `forum_posts` | Anotação privada é lida pelo aluno; publicação leva nome e conteúdo ao fórum autenticado. |
| Conteúdo e colaboração docente | Materiais, slides, livros, vídeos, comentários, fóruns e atribuições. | Tabelas de materiais/biblioteca/fóruns e Blob | Catálogo, leitura, autoria, compartilhamento e coordenação. Campos livres e arquivos podem conter dados de docentes/terceiros. |
| Cobrança e pagamento | Administração cria/edita/baixa; aluno agenda/inicia pagamento; webhook confirma. | `charges` | Portal financeiro, recibo, lembretes, relatórios e baixa. O app não recebe cartão, PIX ou CPF pelo fluxo atual. |
| Push | Navegador fornece endpoint e chaves após permissão. | `push_subscriptions` | Envia avisos de notas/fórum; payload pode conter nome/trecho de mensagem. |
| Auditoria | Sistema registra login/logout e ações. | `audit_logs` | Administração lista e filtra por nome e monta sessões por nome + tipo. `actorId` é gravado, mas não participa da funcionalidade atual. |

### Campos com excesso funcional confirmado

- `charges.mpPreferenceId` e `charges.mpInitPoint`: gravados após criar o checkout Mercado Pago, sem leitura posterior.
- `students.createdAt` e `teachers.createdAt`: não têm consumo funcional explícito identificado.
- `audit_logs.actorId`: hoje é gravado, mas não é usado para filtro ou agrupamento. Não removê-lo antes de trocar a auditoria para usar o ID, evitando colisão entre nomes.
- `students.birthDate`: não é excesso de leitura, pois o portal a exibe, mas não há finalidade operacional além da própria tela. Não continuar solicitando-a sem definir finalidade.

## Telas que precisam de finalidade e transparência

Não há aviso de finalidade, link de política ou aceite registrado em nenhuma delas.

| Tela/fluxo | Dados | Texto obrigatório a ser exibido |
| --- | --- | --- |
| Administração de alunos/importação | Nome, e-mail, telefone, bolsa, planilha | “Usamos estes dados para cadastrar o aluno, permitir acesso ao portal e administrar atividades, frequência e cobranças. Informe apenas dados necessários e comunique o aluno sobre este cadastro.” |
| Primeiro acesso do aluno | Dados de conta e dados já existentes | “Usamos seus dados de cadastro e acadêmicos para fornecer o portal, atividades, notas, frequência e cobranças.” |
| Minha conta | Telefone/WhatsApp, data de nascimento | “O telefone permite contato institucional por WhatsApp. A data de nascimento não tem uso operacional identificado hoje; deixe em branco até haver finalidade definida.” |
| Contas de professores | Nome, e-mail, senha | “Usamos nome e e-mail para criar sua conta, controlar acessos e identificar sua atuação acadêmica.” |
| Recuperação/confirmação de e-mail | E-mail e token temporário | “Usamos seu e-mail somente para confirmar a conta ou enviar um link de redefinição.” |
| Entrega de tarefa | Texto, arquivo, nome do arquivo e feedback | “Usamos sua entrega para avaliar a atividade. Não envie documentos com dados pessoais desnecessários.” |
| Fórum | Nome, título e mensagem | “Sua mensagem e seu nome ficam visíveis aos participantes autenticados do fórum da disciplina.” |
| Reflexão espiritual | Texto potencialmente religioso | “Esta reflexão é voluntária e pode revelar informação religiosa. Hoje ela é visível a professores logados, que podem comentar.” |
| Observação sobre aluno | Texto e nome do professor | “A observação é compartilhada com professores logados para acompanhamento acadêmico; não registre dados sensíveis sem necessidade.” |
| Cobrança/pagamento | Nome, e-mail, dados de cobrança | “Usamos estes dados para administrar a cobrança e enviar lembretes. Ao pagar, você será direcionado ao Mercado Pago.” |
| Push | Endpoint, chaves e conteúdo de aviso | “Ao ativar, guardamos a inscrição deste dispositivo para enviar avisos de notas e fórum.” |
| Agenda externa | Token de URL, nome no calendário e eventos | “Ao assinar esta agenda, Google, Outlook ou Apple receberá o link e os eventos acadêmicos. Quem possuir o link poderá consultar a agenda.” |

O aceite geral deve ser uma **ciência da política**, não uma alegação de consentimento genérico. O registro mínimo é `subject_type`, `subject_id`, `policy_version`, `accepted_at` e `context`. Não coletar IP por padrão. A reflexão espiritual requer consentimento específico, destacado, granular e versionado antes da primeira gravação.

## Direitos do titular

O sistema precisa de uma tela exclusiva para administradores com busca inicial por e-mail, seleção explícita quando houver mais de um resultado e consolidação dos papéis de aluno/professor. A exportação deve produzir um ZIP com `dados.json` estruturado, dados relacionais e anexos do titular quando disponíveis. Nunca incluir hash de senha, token de recuperação/confirmação, token de calendário, chave de push ou segredo de sessão.

A exclusão atual deve ser desativada e substituída por um pedido controlado. Credenciais, tokens, inscrições push, feed de agenda e arquivos devem ser revogados/apagados quando não houver retenção aprovada. O histórico que o controlador comprovar que precisa manter deve ser anonimizado: remover nome, e-mail, telefone, nascimento e snapshots identificáveis, mantendo apenas o mínimo necessário. O código atual não traz tabela de retenção; não é permitido inventar prazo ou alegar que uma categoria é obrigatória.

## Destinatários externos

| Destinatário | Dados enviados pelo código | Localização conhecida |
| --- | --- | --- |
| Neon Postgres | Banco completo do sistema. | Confirmada: Ohio, EUA. |
| Vercel Blob | Arquivos e metadados de upload; atualmente URL pública. | Região física não obtida do código/configuração auditada. |
| Vercel hospedagem/cron | Requisições, cookies de sessão e metadados operacionais próprios de hospedagem. | Região de execução não obtida da configuração auditada. |
| Resend | Destinatário, nome e conteúdo de e-mails de autenticação e cobrança. | EUA, conforme documentação do fornecedor. |
| Mercado Pago | ID interno de cobrança, descrição com nome do aluno, valor e moeda. O checkout coleta dados de pagamento diretamente. | País de processamento não definido no código. |
| Push do navegador | Endpoint, chaves e payload cifrado; provedor depende do navegador. | Dinâmico/indeterminado. |
| Google Fonts | Dados técnicos da requisição do visitante. | Infraestrutura global; país não definido no código. |
| YouTube/`youtube-nocookie`/`ytimg` | Dados técnicos do navegador e ID de vídeo. | Infraestrutura Google global; país não definido no código. |
| Google Docs Viewer | URL pública e conteúdo de Word/PowerPoint enviado para renderização. | Infraestrutura Google global; país não definido no código. |
| Google/Outlook/Apple Calendar | Link-token do feed, nome do calendário e eventos quando o aluno assina. | Escolha do aluno/provedor; país não definido no código. |
| WhatsApp | Telefone e mensagem pré-preenchida com nome/contexto. | Provedor global; país não definido no código. |

## Pré-condições humanas obrigatórias

Antes de publicar política ou executar anonimização em produção, o controlador deve fornecer por escrito:

1. Razão social/CNPJ e endereço do controlador.
2. Canal de contato do encarregado ou privacidade.
3. Finalidade e base legal aprovada para cada grupo de dados.
4. Regra de visibilidade de reflexões espirituais: todos os professores ou apenas docentes/mentores designados.
5. Tabela de retenção por categoria, especialmente acadêmica, financeira, auditável e conteúdo livre.
6. Contratos/DPA e localidade de Vercel, Mercado Pago, push e Google quando a política os mencionar.

## Ordem de execução aprovada para futuras sessões

1. Encerrar exposição pública de anexos e encaminhamento ao Google Docs Viewer.
2. Substituir exclusão em cascata por rotina de direitos e console administrativo.
3. Proteger reflexões espirituais e observações de aluno.
4. Aplicar finalidades, política e ciência/aceite versionado.
5. Fechar registro de transferências, avisos e controles de fornecedores.
6. Minimizar e sanear campos sem uso.
7. Tratar CPF apenas em iniciativa futura aprovada.

Cada item é uma entrega separada. Nenhum agente pode começar o próximo sem aprovação explícita de Diego.
