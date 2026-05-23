export const USERS = [
  { username: "oscar", password: "beachpaddleboxe", displayName: "Oscar" },
  { username: "pascal", password: "beachpaddleboxe", displayName: "Pascal" },
] as const;

const SESSION_KEY = "bp_session";

export interface Session {
  username: string;
  displayName: string;
  loginAt: number;
}

export function login(username: string, password: string): Session | null {
  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return null;
  const session: Session = {
    username: user.username,
    displayName: user.displayName,
    loginAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
