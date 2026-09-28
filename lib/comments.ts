// lib/comments.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CommentRow } from "./comments-client";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const SUPABASE_CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

/** Cliente del lado del servidor. Devuelve null si no está configurado. */
export function supabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

export type { CommentRow };
