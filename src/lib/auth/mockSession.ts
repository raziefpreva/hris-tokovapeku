export type MockRole = "Manager" | "Captain" | "Vaporista";

export interface MockSession {
  nik: string;
  role: MockRole;
  nama: string;
  userId: string;
}

const KEY = "tokovapeku_mock_session";

export const MOCK_USERS: Record<
  string,
  { password: string; role: MockRole; nama: string; userId: string }
> = {
  "100001": {
    password: "password123",
    role: "Manager",
    nama: "Manager Demo",
    userId: "mock-manager-100001",
  },
  "200017": {
    password: "password123",
    role: "Captain",
    nama: "Captain Demo",
    userId: "mock-captain-200017",
  },
  "300001": {
    password: "password123",
    role: "Vaporista",
    nama: "Vaporista Demo",
    userId: "mock-vaporista-300001",
  },
};

export function tryMockLogin(nik: string, password: string): MockSession | null {
  const u = MOCK_USERS[nik];
  if (!u || u.password !== password) return null;
  const session: MockSession = { nik, role: u.role, nama: u.nama, userId: u.userId };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  }
  return session;
}

export function getMockSession(): MockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

export function clearMockSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
}

export function landingPathForRole(role: MockRole): string {
  if (role === "Manager") return "/app";
  if (role === "Captain") return "/app/verifikasi";
  return "/app/tugas";
}