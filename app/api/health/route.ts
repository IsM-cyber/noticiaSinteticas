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
      // La tabla principal es chat_messages. La vieja "comments" ya no existe
      // en este proyecto y consultarla hacia fallar todo el chequeo.
      const { error } = await admin.from("chat_messages").select("id").limit(1);
      if (error) {
        result.db = `ERROR: ${error.message}`;
      } else {
        result.db = "OK";
        result.tables = { chat_messages: "OK" };
      }
    }
  } else {
    result.db = "SKIPPED (faltan variables)";
  }

  return NextResponse.json(result, { status: 200 });
}
