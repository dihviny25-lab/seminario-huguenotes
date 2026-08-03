/** Quantas das aulas informadas estão marcadas como falta (ausentes). */
export function countFaltas(lessonIds: Array<string>, absentLessonIds: Set<string>): number {
  return lessonIds.filter((id) => absentLessonIds.has(id)).length;
}
