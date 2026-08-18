import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CommentRow } from "./comments-client";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const SUPABASE_CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

/** Cliente del lado del servidor con permisos de moderación. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Email del dueño (puede moderar). Se configura en Vercel. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export type { CommentRow };