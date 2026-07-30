import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireTeacherFn } from "@/functions/auth";

/**
 * Layout protegido: qualquer rota abaixo de /painel exige sessão válida.
 * Se a senha ainda é a temporária (mustChangePassword), força a troca antes
 * de liberar qualquer outra tela do painel.
 */
export const Route = createFileRoute("/painel")({
  beforeLoad: async ({ location }) => {
    let status: { mustChangePassword: boolean };
    try {
      status = await requireTeacherFn();
    } catch {
      throw redirect({ to: "/login" });
    }
    if (status.mustChangePassword && location.pathname !== "/painel/trocar-senha") {
      throw redirect({ to: "/painel/trocar-senha" });
    }
  },
  component: () => <Outlet />,
});
