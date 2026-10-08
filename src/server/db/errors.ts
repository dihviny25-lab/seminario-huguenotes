/** Erro do Postgres pra violação de constraint única (ex.: e-mail duplicado). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** RAISE EXCEPTION do trigger `teachers_min_super_admin` (ver migration 0003). */
export function isLastSuperAdminViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.includes("remover o último super admin")
  );
}
