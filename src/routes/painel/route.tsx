import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireTeacherFn } from "@/functions/auth";

/** Layout protegido: qualquer rota abaixo de /painel exige sessão válida. */
export const Route = createFileRoute("/painel")({
  beforeLoad: async () => {
    try {
      await requireTeacherFn();
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
