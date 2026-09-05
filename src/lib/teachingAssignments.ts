export function effectiveTeacherId(
  lessonTeacherId: string | null,
  disciplineTeacherId: string | null,
) {
  return lessonTeacherId ?? disciplineTeacherId;
}

export function isFutureOrToday(date: string, today = new Date().toISOString().slice(0, 10)) {
  return date >= today;
}
