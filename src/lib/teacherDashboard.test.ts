import { describe, expect, it } from "vitest";

import {
  buildTeacherDashboard,
  computeDisciplineProgress,
  MISSING_GRADES_LIMIT,
  pickAtRiskStudents,
  pickEndingDisciplines,
  pickForumActivity,
  pickMaterialGaps,
  pickMissingAttendance,
  pickMissingGrades,
  pickPendingGrading,
  pickUpcomingLessons,
  type DashboardInput,
} from "@/lib/teacherDashboard";

const TODAY = "2026-08-28";

function emptyInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    scope: "minhas",
    today: TODAY,
    disciplines: [],
    lessons: [],
    attendance: [],
    readingMaterials: [],
    videoLessons: [],
    assessments: [],
    grades: [],
    assignments: [],
    submissions: [],
    threads: [],
    posts: [],
    activeStudents: [],
    ...overrides,
  };
}

// helper: N aulas dadas (datas passadas) + M aulas futuras para uma disciplina
function lessonsFor(
  disciplineId: string,
  given: number,
  future: number,
): DashboardInput["lessons"] {
  const rows: DashboardInput["lessons"] = [];
  for (let i = 0; i < given; i++) {
    rows.push({ id: `${disciplineId}-p${i}`, disciplineId, date: "2026-08-01", sequence: i + 1 });
  }
  for (let i = 0; i < future; i++) {
    rows.push({
      id: `${disciplineId}-f${i}`,
      disciplineId,
      date: "2026-12-01",
      sequence: given + i + 1,
    });
  }
  return rows;
}

describe("computeDisciplineProgress", () => {
  it("usa disciplines.lessons como denominador quando presente", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 10 },
      lessonsFor("d1", 8, 0),
      TODAY,
    );
    expect(p).toMatchObject({
      lessonsGiven: 8,
      lessonsPlanned: 10,
      isStarted: true,
      isEnded: false,
    });
    expect(p.progress).toBeCloseTo(0.8);
  });

  it("cai para o total de lessons cadastradas quando lessons é null", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: null },
      lessonsFor("d1", 3, 1), // 4 no total, 3 dadas
      TODAY,
    );
    expect(p.lessonsPlanned).toBe(4);
    expect(p.progress).toBeCloseTo(0.75);
  });

  it("progress = 0 quando não há aulas planejadas", () => {
    const p = computeDisciplineProgress({ id: "d1", discipline: "A", lessons: null }, [], TODAY);
    expect(p).toMatchObject({ lessonsGiven: 0, lessonsPlanned: 0, progress: 0, isStarted: false });
  });

  it("isEnded quando progress >= 1", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 4 },
      lessonsFor("d1", 4, 0),
      TODAY,
    );
    expect(p).toMatchObject({ progress: 1, isEnded: true });
  });

  it("ignora aulas sem data e aulas futuras na contagem de dadas", () => {
    const p = computeDisciplineProgress(
      { id: "d1", discipline: "A", lessons: 10 },
      [
        { disciplineId: "d1", date: "2026-08-01" },
        { disciplineId: "d1", date: null },
        { disciplineId: "d1", date: "2026-12-31" },
      ],
      TODAY,
    );
    expect(p.lessonsGiven).toBe(1);
  });
});

describe("pickEndingDisciplines", () => {
  const base = emptyInput({
    disciplines: [
      { id: "d80", discipline: "Oitenta", lessons: 10 },
      { id: "d79", discipline: "SetentaNove", lessons: 100 },
      { id: "d100", discipline: "Cem", lessons: 4 },
    ],
    lessons: [
      ...lessonsFor("d80", 8, 2),
      ...lessonsFor("d79", 79, 21),
      ...lessonsFor("d100", 4, 0),
    ],
  });

  it("inclui progress exatamente 0.8, exclui 0.79 e exclui >= 1", () => {
    const out = pickEndingDisciplines(base);
    expect(out.map((d) => d.disciplineId)).toEqual(["d80"]);
  });

  it("ordena por progress desc", () => {
    const input = emptyInput({
      disciplines: [
        { id: "a", discipline: "A", lessons: 10 },
        { id: "b", discipline: "B", lessons: 10 },
      ],
      lessons: [...lessonsFor("a", 8, 2), ...lessonsFor("b", 9, 1)],
    });
    expect(pickEndingDisciplines(input).map((d) => d.disciplineId)).toEqual(["b", "a"]);
  });
});

describe("pickMaterialGaps", () => {
  it("marca sem apostila e sem vídeo, e calcula apostilaDeficit", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 5, 0),
      readingMaterials: [{ disciplineId: "d1" }, { disciplineId: "d1" }],
      videoLessons: [],
    });
    const [gap] = pickMaterialGaps(input);
    expect(gap).toMatchObject({
      disciplineId: "d1",
      missingApostila: false,
      missingVideos: true,
      lessonsGiven: 5,
      apostilaCount: 2,
      apostilaDeficit: 3,
    });
  });

  it("inclui disciplina totalmente sem material", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 2, 0),
    });
    const [gap] = pickMaterialGaps(input);
    expect(gap).toMatchObject({ missingApostila: true, missingVideos: true, apostilaDeficit: 2 });
  });

  it("exclui disciplina não iniciada e disciplina encerrada", () => {
    const input = emptyInput({
      disciplines: [
        { id: "naoIniciada", discipline: "NI", lessons: 10 },
        { id: "encerrada", discipline: "E", lessons: 2 },
      ],
      lessons: [...lessonsFor("naoIniciada", 0, 3), ...lessonsFor("encerrada", 2, 0)],
    });
    expect(pickMaterialGaps(input)).toEqual([]);
  });

  it("não inclui disciplina com apostila e vídeo e sem déficit", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "A", lessons: 10 }],
      lessons: lessonsFor("d1", 2, 0),
      readingMaterials: [{ disciplineId: "d1" }, { disciplineId: "d1" }],
      videoLessons: [{ disciplineId: "d1" }],
    });
    expect(pickMaterialGaps(input)).toEqual([]);
  });
});

describe("pickPendingGrading", () => {
  const input = emptyInput({
    disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
    assignments: [
      { id: "a1", disciplineId: "d1", title: "Tarefa 1" },
      { id: "a2", disciplineId: "d1", title: "Tarefa 2" },
    ],
    submissions: [
      { assignmentId: "a1", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null },
      { assignmentId: "a1", submittedAt: "2026-08-05T10:00:00.000Z", gradedAt: null },
      {
        assignmentId: "a1",
        submittedAt: "2026-08-01T10:00:00.000Z",
        gradedAt: "2026-08-02T10:00:00.000Z",
      },
      { assignmentId: "a2", submittedAt: null, gradedAt: null },
      { assignmentId: "a2", submittedAt: "2026-08-20T10:00:00.000Z", gradedAt: null },
    ],
  });

  it("conta só submittedAt != null && gradedAt == null e agrupa por tarefa", () => {
    const { items, total } = pickPendingGrading(input);
    expect(total).toBe(3);
    const a1 = items.find((i) => i.assignmentId === "a1")!;
    expect(a1).toMatchObject({
      awaitingCount: 2,
      oldestSubmittedAt: "2026-08-05T10:00:00.000Z",
      disciplineName: "Disc",
    });
  });

  it("ordena por oldestSubmittedAt asc", () => {
    const { items } = pickPendingGrading(input);
    expect(items.map((i) => i.assignmentId)).toEqual(["a1", "a2"]);
  });

  it("mantém ordem estável (insertion order) quando oldestSubmittedAt empata", () => {
    // Regressão do comparador `(a, b) => (a.x < b.x ? -1 : 1)`: em caso de
    // empate ele retornava 1 (não 0), o que podia inverter a ordem original.
    const tieInput = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      assignments: [
        { id: "a1", disciplineId: "d1", title: "Tarefa 1" },
        { id: "a2", disciplineId: "d1", title: "Tarefa 2" },
      ],
      submissions: [
        { assignmentId: "a1", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null },
        { assignmentId: "a2", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null },
      ],
    });
    const { items } = pickPendingGrading(tieInput);
    expect(items.map((i) => i.assignmentId)).toEqual(["a1", "a2"]);
  });
});

describe("pickMissingGrades", () => {
  const disciplines = [{ id: "d1", discipline: "Disc", lessons: 10 }];
  const activeStudents = [
    { id: "s1", name: "A" },
    { id: "s2", name: "B" },
    { id: "s3", name: "C" },
  ];
  const assessments = [
    { id: "av1", disciplineId: "d1", title: "Prova", weight: 1 },
    { id: "av2", disciplineId: "d1", title: "Completa", weight: 1 },
  ];
  const grades = [
    { assessmentId: "av1", studentId: "s1", score: 8 },
    { assessmentId: "av2", studentId: "s1", score: 7 },
    { assessmentId: "av2", studentId: "s2", score: 6 },
    { assessmentId: "av2", studentId: "s3", score: 9 },
  ];

  it("studentsMissing = alunos ativos - studentIds distintos com nota, em disciplina iniciada e não encerrada", () => {
    const input = emptyInput({
      disciplines,
      lessons: lessonsFor("d1", 3, 5), // progress 0.3 — iniciada e não encerrada
      activeStudents,
      assessments,
      grades,
    });
    const out = pickMissingGrades(input);
    expect(out).toEqual([
      {
        assessmentId: "av1",
        disciplineId: "d1",
        title: "Prova",
        disciplineName: "Disc",
        studentsMissing: 2,
      },
    ]);
  });

  it("exclui disciplina ainda não iniciada (progress <= 0)", () => {
    const input = emptyInput({
      disciplines,
      lessons: lessonsFor("d1", 0, 5), // nenhuma aula dada ainda
      activeStudents,
      assessments,
      grades,
    });
    expect(pickMissingGrades(input)).toEqual([]);
  });

  it("exclui disciplina já encerrada (progress >= 1)", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 4 }],
      lessons: lessonsFor("d1", 4, 0), // 4/4 = encerrada
      activeStudents,
      assessments,
      grades,
    });
    expect(pickMissingGrades(input)).toEqual([]);
  });

  it("respeita MISSING_GRADES_LIMIT", () => {
    const manyAssessments = Array.from({ length: MISSING_GRADES_LIMIT + 4 }, (_, i) => ({
      id: `av${i}`,
      disciplineId: "d1",
      title: `Av${i}`,
      weight: 1,
    }));
    const input = emptyInput({
      disciplines,
      lessons: lessonsFor("d1", 3, 5),
      activeStudents,
      assessments: manyAssessments,
      grades: [],
    });
    expect(pickMissingGrades(input)).toHaveLength(MISSING_GRADES_LIMIT);
  });
});

describe("pickMissingAttendance", () => {
  it("conta aulas passadas sem nenhuma linha de attendance, agrupadas por disciplina", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-08-08", sequence: 2 },
        { id: "l3", disciplineId: "d1", date: "2026-12-01", sequence: 3 }, // futura
      ],
      attendance: [{ lessonId: "l1", studentId: "s1", present: true }],
    });
    const { items, total } = pickMissingAttendance(input);
    expect(total).toBe(1);
    expect(items).toEqual([
      { disciplineId: "d1", disciplineName: "Disc", lessonsWithoutAttendance: 1 },
    ]);
  });
});

describe("pickUpcomingLessons", () => {
  it("pega aulas com date > hoje, ordena asc e corta no limite", () => {
    const input = emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "p", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "f2", disciplineId: "d1", date: "2026-09-10", sequence: 3 },
        { id: "f1", disciplineId: "d1", date: "2026-09-01", sequence: 2 },
      ],
    });
    const out = pickUpcomingLessons(input);
    expect(out.map((l) => l.date)).toEqual(["2026-09-01", "2026-09-10"]);
    expect(out[0]).toMatchObject({ disciplineId: "d1", disciplineName: "Disc", sequence: 2 });
  });
});

describe("pickForumActivity", () => {
  const input = emptyInput({
    disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
    threads: [
      {
        id: "t1",
        disciplineId: "d1",
        title: "Sem resposta",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
      { id: "t2", disciplineId: "d1", title: "Respondido", createdAt: "2026-08-02T10:00:00.000Z" },
    ],
    posts: [
      { threadId: "t1", authorRole: "student", createdAt: "2026-08-01T10:00:00.000Z" },
      { threadId: "t1", authorRole: "student", createdAt: "2026-08-10T10:00:00.000Z" },
      { threadId: "t2", authorRole: "student", createdAt: "2026-08-02T10:00:00.000Z" },
      { threadId: "t2", authorRole: "teacher", createdAt: "2026-08-03T10:00:00.000Z" },
    ],
  });

  it("marca awaitingTeacherReply quando o último post é de aluno", () => {
    const out = pickForumActivity(input);
    expect(out.find((t) => t.threadId === "t1")).toMatchObject({
      awaitingTeacherReply: true,
      postCount: 2,
      lastActivityAt: "2026-08-10T10:00:00.000Z",
      disciplineName: "Disc",
    });
    expect(out.find((t) => t.threadId === "t2")!.awaitingTeacherReply).toBe(false);
  });

  it("ordena os aguardando na frente, depois por lastActivityAt desc", () => {
    expect(pickForumActivity(input).map((t) => t.threadId)).toEqual(["t1", "t2"]);
  });

  it("respeita FORUM_ITEMS_LIMIT", () => {
    const many = emptyInput({
      disciplines: [{ id: "d1", discipline: "D", lessons: 10 }],
      threads: Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        disciplineId: "d1",
        title: `T${i}`,
        createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      })),
      posts: Array.from({ length: 12 }, (_, i) => ({
        threadId: `t${i}`,
        authorRole: "teacher" as const,
        createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      })),
    });
    expect(pickForumActivity(many)).toHaveLength(8);
  });
});

describe("pickAtRiskStudents", () => {
  function riskInput(): DashboardInput {
    return emptyInput({
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      activeStudents: [
        { id: "s1", name: "Ana" },
        { id: "s2", name: "Bia" },
        { id: "s3", name: "Cida" },
      ],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-08-02", sequence: 2 },
        { id: "l3", disciplineId: "d1", date: "2026-08-03", sequence: 3 },
        { id: "l4", disciplineId: "d1", date: "2026-08-04", sequence: 4 },
      ],
      assessments: [{ id: "av1", disciplineId: "d1", title: "P1", weight: 1 }],
      grades: [
        { assessmentId: "av1", studentId: "s1", score: 5 }, // média baixa
        { assessmentId: "av1", studentId: "s2", score: 9 },
      ],
      attendance: [
        // s2: 1 falta em 4 = 75% presença -> NÃO é risco (estritamente < 0.75)
        { lessonId: "l1", studentId: "s2", present: false },
        { lessonId: "l2", studentId: "s2", present: true },
        { lessonId: "l3", studentId: "s2", present: true },
        { lessonId: "l4", studentId: "s2", present: true },
        // s1: 2 faltas em 4 = 50% -> risco de frequência também
        { lessonId: "l1", studentId: "s1", present: false },
        { lessonId: "l2", studentId: "s1", present: false },
        { lessonId: "l3", studentId: "s1", present: true },
        { lessonId: "l4", studentId: "s1", present: true },
      ],
    });
  }

  it("s1 entra com reason 'ambos'; s2 e s3 não entram", () => {
    const { items, total } = pickAtRiskStudents(riskInput());
    expect(total).toBe(1);
    expect(items).toEqual([
      {
        studentId: "s1",
        studentName: "Ana",
        disciplines: [{ disciplineName: "Disc", reason: "ambos" }],
      },
    ]);
  });

  it("frequência exatamente 0.75 não é risco", () => {
    const input = riskInput();
    input.grades = [{ assessmentId: "av1", studentId: "s2", score: 9 }]; // tira nota baixa de s1
    input.attendance = input.attendance.filter((a) => a.studentId === "s2");
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("aluno sem nenhuma nota não entra por média", () => {
    const input = riskInput();
    input.grades = [];
    input.attendance = [];
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("exclui disciplina encerrada e não iniciada", () => {
    const input = riskInput();
    input.disciplines = [{ id: "d1", discipline: "Disc", lessons: 4 }]; // 4 dadas / 4 = encerrada
    expect(pickAtRiskStudents(input).items).toEqual([]);
  });

  it("ordena por nº de disciplinas em risco desc e corta em AT_RISK_LIMIT", () => {
    const disciplines = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      discipline: `D${i}`,
      lessons: 10,
    }));
    const lessons = disciplines.flatMap((d) => [
      { id: `${d.id}-l1`, disciplineId: d.id, date: "2026-08-01", sequence: 1 },
    ]);
    const assessments = disciplines.map((d) => ({
      id: `${d.id}-av`,
      disciplineId: d.id,
      title: "P",
      weight: 1,
    }));
    // s1 reprova em todas as 10; s2 reprova só em 1
    const grades = [
      ...assessments.map((a) => ({ assessmentId: a.id, studentId: "s1", score: 1 })),
      { assessmentId: "d0-av", studentId: "s2", score: 1 },
    ];
    const input = emptyInput({
      disciplines,
      lessons,
      assessments,
      grades,
      activeStudents: [
        { id: "s1", name: "Ana" },
        { id: "s2", name: "Bia" },
      ],
    });
    const { items, total } = pickAtRiskStudents(input);
    expect(total).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[0].studentId).toBe("s1");
    expect(items[0].disciplines).toHaveLength(8); // AT_RISK_LIMIT aplicado à lista interna
  });
});

describe("buildTeacherDashboard", () => {
  it("monta counts a partir dos sub-resultados e propaga scope", () => {
    const input = emptyInput({
      scope: "minhas",
      disciplines: [{ id: "d1", discipline: "Disc", lessons: 10 }],
      lessons: [
        { id: "l1", disciplineId: "d1", date: "2026-08-01", sequence: 1 },
        { id: "l2", disciplineId: "d1", date: "2026-09-01", sequence: 2 },
      ],
      assignments: [{ id: "a1", disciplineId: "d1", title: "T1" }],
      submissions: [
        { assignmentId: "a1", submittedAt: "2026-08-10T10:00:00.000Z", gradedAt: null },
      ],
    });
    const out = buildTeacherDashboard(input);
    expect(out.scope).toBe("minhas");
    expect(out.counts).toMatchObject({
      pendingGrading: 1,
      lessonsWithoutAttendance: 1,
      endingDisciplines: 0,
      atRiskStudents: 0,
    });
    expect(out.upcomingLessons).toHaveLength(1);
  });

  it("tudo vazio ⇒ counts zerados e todas as listas vazias", () => {
    const out = buildTeacherDashboard(emptyInput());
    expect(out.counts).toEqual({
      pendingGrading: 0,
      endingDisciplines: 0,
      atRiskStudents: 0,
      lessonsWithoutAttendance: 0,
    });
    for (const key of [
      "materialGaps",
      "pendingGrading",
      "missingGrades",
      "missingAttendance",
      "endingDisciplines",
      "forum",
      "upcomingLessons",
      "atRiskStudents",
    ] as const) {
      expect(out[key]).toEqual([]);
    }
  });
});
