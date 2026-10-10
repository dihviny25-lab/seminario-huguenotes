import { describe, expect, it } from "vitest";

import { getDisciplineCompletion, summarizeDisciplineFeedback } from "./disciplineFeedback";

describe("getDisciplineCompletion", () => {
  it("só libera a avaliação quando todas as aulas previstas foram dadas", () => {
    expect(
      getDisciplineCompletion(3, [
        { givenAt: "2026-08-01" },
        { givenAt: "2026-08-08" },
        { givenAt: null },
      ]),
    ).toEqual({ lessonsGiven: 2, lessonsPlanned: 3, isCompleted: false });

    expect(
      getDisciplineCompletion(3, [
        { givenAt: "2026-08-01" },
        { givenAt: "2026-08-08" },
        { givenAt: "2026-08-15" },
      ]),
    ).toEqual({ lessonsGiven: 3, lessonsPlanned: 3, isCompleted: true });
  });

  it("usa as aulas cadastradas quando a quantidade prevista não está definida", () => {
    expect(
      getDisciplineCompletion(null, [{ givenAt: new Date() }, { givenAt: new Date() }]),
    ).toEqual({ lessonsGiven: 2, lessonsPlanned: 2, isCompleted: true });
  });

  it("não considera uma disciplina sem aulas como encerrada", () => {
    expect(getDisciplineCompletion(null, [])).toEqual({
      lessonsGiven: 0,
      lessonsPlanned: 0,
      isCompleted: false,
    });
  });
});

describe("summarizeDisciplineFeedback", () => {
  it("calcula média e distribuição e remove qualquer identificação dos comentários", () => {
    const summary = summarizeDisciplineFeedback([
      { rating: 5, likedMost: "Debates", couldImprove: "Mais tempo", additionalComments: null },
      {
        rating: 3,
        likedMost: "Material",
        couldImprove: "Mais exercícios",
        additionalComments: "Obrigado",
      },
    ]);

    expect(summary.responseCount).toBe(2);
    expect(summary.averageRating).toBe(4);
    expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
    expect(summary.comments).toEqual([
      { likedMost: "Debates", couldImprove: "Mais tempo", additionalComments: null },
      {
        likedMost: "Material",
        couldImprove: "Mais exercícios",
        additionalComments: "Obrigado",
      },
    ]);
  });

  it("não inventa uma média quando ainda não há respostas", () => {
    expect(summarizeDisciplineFeedback([])).toMatchObject({
      responseCount: 0,
      averageRating: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      comments: [],
    });
  });
});
