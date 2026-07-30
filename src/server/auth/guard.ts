import { readAppSession } from "./session";

/** Garante que existe um professor logado; lança erro caso contrário. */
export async function requireTeacherId(): Promise<string> {
  const session = await readAppSession();
  const teacherId = session.data.teacherId;
  if (!teacherId) {
    throw new Error("UNAUTHORIZED");
  }
  return teacherId;
}
