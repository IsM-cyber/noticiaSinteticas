import { NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_CONFIGURED } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de configuración. Responde solo nombres de variables y
 * longitudes, NUNCA valores. Sirve para no adivinar a ciegas por deploys.
 * Es temporal: se puede borrar cuando todo ande.
 */
export async function GET() {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.length : 0,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? process.env.NEXT_PUBLIC_SUPABASE_URL.length
      : 0,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? process.env.SUPABASE_SERVICE_ROLE_KEY.length
      : 0,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "set" : "missing",
  };

  const resolvedUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;

  const result: Record<string, unknown> = {
    configured: SUPABASE_CONFIGURED,
    resolvedUrl,
    envLengths: env,
    db: "not-tested",
    tables: null,
  };

  if (resolvedUrl && SUPABASE_CONFIGURED) {
    const admin = supabaseAdmin();
    if (admin) {
      // Las tres tablas del proyecto: comentarios, chat y bloqueos.
      const tables: Record<string, string> = {};
      let firstError: string | null = null;

      for (const name of ["comments", "chat_messages", "banned_users"]) {
        const { error } = await admin.from(name).select("*").limit(1);
        tables[name] = error ? `ERROR: ${error.message}` : "OK";
        if (error && !firstError) firstError = error.message;
      }

      result.tables = tables;
      result.db = firstError ? `ERROR: ${firstError}` : "OK";
    }
  } else {
    result.db = "SKIPPED (faltan variables)";
  }

  return NextResponse.json(result, { status: 200 });
}
