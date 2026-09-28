import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CommentRow } from "./comments-client";

// Credenciales con respaldo directo para el servidor
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://noticiasinteticas.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_VWr41XwLgexSou8zsbKVBg_s3ImXse4";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_-fTnJwa3LgMohIZdu84Iqw_3umD7aoW";

export const SUPABASE_CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

/** Cliente del lado del servidor con permisos de moderación. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Email del dueño (puede moderar). */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tu-email@ejemplo.com";

export type { CommentRow };
