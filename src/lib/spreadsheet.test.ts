import { describe, expect, it } from "vitest";

import { parseStudentRows } from "./spreadsheet";

describe("parseStudentRows", () => {
  it("detecta colunas comuns e ignora linhas sem nome", () => {
    expect(
      parseStudentRows([
        ["Nome do Aluno", "E-mail", "WhatsApp"],
        ["Ana Silva", "ana@example.com", "(18) 99999-0000"],
        ["", "vazio@example.com", ""],
      ]),
    ).toEqual([
      {
        name: "Ana Silva",
        email: "ana@example.com",
        phone: "(18) 99999-0000",
      },
    ]);
  });

  it("aceita arquivo sem colunas opcionais", () => {
    expect(parseStudentRows([["Aluno"], ["João"]])).toEqual([
      { name: "João", email: null, phone: null },
    ]);
  });

  it("recusa planilha sem coluna de nome", () => {
    expect(() => parseStudentRows([["E-mail", "Telefone"], ["a@b.com", "123"]])).toThrow(
      "Não encontrei uma coluna de nome",
    );
  });
});
