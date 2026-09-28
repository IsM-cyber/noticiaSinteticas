import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// DEBUG: Imprimir en consola para ver qué está pasando en Vercel
console.log("DEBUG ENV:", { URL_exists: !!URL, ANON_KEY_exists: !!ANON_KEY });

export const COMMENTS_CONFIGURED = Boolean(URL && ANON_KEY);

export function supabaseBrowser(): SupabaseClient | null {
  if (!COMMENTS_CONFIGURED) {
    console.error("Supabase NO está configurado. URL:", URL, "ANON_KEY:", ANON_KEY);
    return null;
  }
  return createClient(URL, ANON_KEY);
}

export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}
