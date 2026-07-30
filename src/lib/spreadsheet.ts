export type ParsedStudent = { name: string; email: string | null };

const NAME_HEADER_HINTS = ["nome", "name", "aluno"];
const EMAIL_HEADER_HINTS = ["e-mail", "email"];

function findColumn(headers: string[], hints: string[]): string | undefined {
  return headers.find((header) => {
    const normalized = header.trim().toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });
}

/**
 * Lê a primeira aba de uma planilha .xlsx ou .csv e extrai nome/e-mail,
 * detectando a coluna certa pelo cabeçalho (ex.: "Nome", "E-mail").
 */
export async function parseStudentsFile(file: File): Promise<ParsedStudent[]> {
  // Import sob demanda: a lib só é baixada quando alguém realmente usa o
  // botão de importar, em vez de inflar o bundle inicial (e o SSR) à toa.
  const XLSX = await import("xlsx");
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const nameColumn = findColumn(headers, NAME_HEADER_HINTS);
  const emailColumn = findColumn(headers, EMAIL_HEADER_HINTS);
  if (!nameColumn) {
    throw new Error(
      `Não encontrei uma coluna de nome na planilha (colunas: ${headers.join(", ")}).`,
    );
  }

  return rows
    .map((row) => ({
      name: String(row[nameColumn] ?? "").trim(),
      email: emailColumn ? String(row[emailColumn] ?? "").trim() || null : null,
    }))
    .filter((row) => row.name.length > 0);
}
