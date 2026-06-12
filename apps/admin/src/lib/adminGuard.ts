import { getIdTokenResult } from "firebase/auth";
import { auth } from "./firebase";

export async function isAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await getIdTokenResult(user, true);
  return token.claims["admin"] === true;
}
