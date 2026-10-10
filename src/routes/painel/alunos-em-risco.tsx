import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/painel/alunos-em-risco")({
  validateSearch: z.object({ studentId: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Alunos em risco — Seminário Huguenotes" }] }),
});
