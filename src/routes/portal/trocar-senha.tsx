import { createFileRoute } from "@tanstack/react-router";

import { StudentChangePassword } from "@/pages/StudentChangePassword";

export const Route = createFileRoute("/portal/trocar-senha")({
  head: () => ({
    meta: [{ title: "Trocar senha — Seminário Huguenotes" }],
  }),
  component: StudentChangePassword,
});
