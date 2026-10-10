export type DisciplineCompletion = {
  lessonsGiven: number;
  lessonsPlanned: number;
  isCompleted: boolean;
};

export type FeedbackAnswer = {
  rating: number;
  likedMost: string;
  couldImprove: string;
  additionalComments: string | null;
};

export function getDisciplineCompletion(
  plannedLessons: number | null,
  lessonRows: Array<{ givenAt: Date | string | null }>,
): DisciplineCompletion {
  const lessonsPlanned = plannedLessons ?? lessonRows.length;
  const lessonsGiven = lessonRows.reduce(
    (total, lesson) => total + (lesson.givenAt === null ? 0 : 1),
    0,
  );

  return {
    lessonsGiven,
    lessonsPlanned,
    isCompleted: lessonsPlanned > 0 && lessonsGiven >= lessonsPlanned,
  };
}

export function summarizeDisciplineFeedback(answers: FeedbackAnswer[]) {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let ratingTotal = 0;
  for (const answer of answers) {
    const rating = answer.rating as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    ratingTotal += rating;
  }

  return {
    responseCount: answers.length,
    averageRating: answers.length === 0 ? null : ratingTotal / answers.length,
    distribution,
    comments: answers.map(({ likedMost, couldImprove, additionalComments }) => ({
      likedMost,
      couldImprove,
      additionalComments,
    })),
  };
}
