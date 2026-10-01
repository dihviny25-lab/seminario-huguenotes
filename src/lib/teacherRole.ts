export type TeacherRole = "teacher" | "admin" | "super_admin";

/**
 * admin e super_admin têm os mesmos poderes de gestão (qualquer disciplina/
 * professor/aula, Financeiro, Auditoria etc.) — super_admin só soma a visão
 * da escola inteira por cima, checada separadamente por `isSuperAdminRole`.
 */
export function isAdminRole(role: TeacherRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** `true` só pro papel mais alto — gate exclusivo da visão de escola inteira. */
export function isSuperAdminRole(role: TeacherRole | null | undefined): boolean {
  return role === "super_admin";
}
