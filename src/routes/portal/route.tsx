import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireStudentFn } from "@/functions/studentAuth";

/**
 * Layout protegido: qualquer rota abaixo de /portal exige sessão de aluno.
 * Se a senha ainda é a temporária (mustChangePassword), força a troca antes
 * de liberar o resto do portal.
 */
export const Route = createFileRoute("/portal")({
  beforeLoad: async ({ location }) => {
    let status: { mustChangePassword: boolean };
    try {
      status = await requireStudentFn();
    } catch {
      throw redirect({ to: "/login-aluno" });
    }
    if (status.mustChangePassword && location.pathname !== "/portal/trocar-senha") {
      throw redirect({ to: "/portal/trocar-senha" });
    }
  },
  component: () => <Outlet />,
});
