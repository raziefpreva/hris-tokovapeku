// Convert a NIK to a pseudo-email so Supabase Auth can handle it.
export const NIK_DOMAIN = "vapehris.internal";

export function nikToEmail(nik: string): string {
  return `${nik.trim().toLowerCase()}@${NIK_DOMAIN}`;
}

export function emailToNik(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(0, at) : email;
}