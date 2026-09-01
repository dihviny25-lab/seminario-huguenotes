export type ParsedStudent = { name: string; email: string | null; phone: string | null };

const NAME_HEADER_HINTS = ["nome", "name", "aluno"];
const EMAIL_HEADER_HINTS = ["e-mail", "email"];
const PHONE_HEADER_HINTS = ["whatsapp", "whats", "celular", "telefone", "fone"];

function findColumnIndex(headers: string[], hints: string[]): number {
  return headers.findIndex((header) => {
    const normalized = header.trim().toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter = semicolons > commas ? ";" : ",";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

export function parseStudentRows(rows: readonly (readonly unknown[])[]): ParsedStudent[] {
  if (rows.length === 0) return [];

  const headers = (rows[0] ?? []).map((value) => String(value ?? ""));
  const nameIndex = findColumnIndex(headers, NAME_HEADER_HINTS);
  const emailIndex = findColumnIndex(headers, EMAIL_HEADER_HINTS);
  const phoneIndex = findColumnIndex(headers, PHONE_HEADER_HINTS);

  if (nameIndex < 0) {
    throw new Error(
      `Não encontrei uma coluna de nome na planilha (colunas: ${headers.join(", ")}).`,
    );
  }

  return rows
    .slice(1)
    .map((row) => ({
      name: String(row[nameIndex] ?? "").trim(),
      email: emailIndex >= 0 ? String(row[emailIndex] ?? "").trim() || null : null,
      phone: phoneIndex >= 0 ? String(row[phoneIndex] ?? "").trim() || null : null,
    }))
    .filter((student) => student.name.length > 0);
}

/**
 * Lê a primeira aba de uma planilha .xlsx ou .csv e extrai nome/e-mail/telefone,
 * detectando as colunas pelo cabeçalho. XLSX é processado por uma biblioteca
 * focada apenas em leitura; CSV usa parser local para não ampliar dependências.
 */
export async function parseStudentsFile(file: File): Promise<ParsedStudent[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseStudentRows(parseCsv(await file.text()));
  }

  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return parseStudentRows(rows);
}
