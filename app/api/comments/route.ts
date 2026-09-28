import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, publicAuthor, safeAuthor, SUPABASE_CONFIGURED } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * El autor nunca sale completo: el editor es "Editor" y el resto va enmascarado.
 * El enmascarado se hace en el servidor, no en el cliente.
 */
export async function GET(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) return NextResponse.json({ comments: [] });

  const story = req.nextUrl.searchParams.get("story") ?? "";
  if (!story) return NextResponse.json({ error: "falta story" }, { status: 400 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ comments: [] });

  const { data, error } = await admin
    .from("comments")
    .select("id, author, body, created_at")
    .eq("story_key", story)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    comments: (data ?? []).map((c) => ({ ...c, author: publicAuthor(c.author) })),
  });
}

/** Crear comentario. Requiere sesión válida y no estar baneado. */
export async function POST(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "comentarios no configurados" }, { status: 501 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no logueado" }, { status: 401 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "error de sistema" }, { status: 500 });

  const { data: user, error: authError } = await admin.auth.getUser(token);
  if (authError || !user.user) return NextResponse.json({ error: "sesión inválida" }, { status: 401 });

  const rawEmail = user.user.email ?? "";

  // ¿Bloqueado por id o por email?
  const { data: bannedByUser } = await admin
    .from("banned_users").select("user_id").eq("user_id", user.user.id).maybeSingle();
  const { data: bannedByEmail } = rawEmail
    ? await admin.from("banned_users").select("user_id").eq("email", rawEmail).maybeSingle()
    : { data: null };
  if (bannedByUser || bannedByEmail) {
    return NextResponse.json({ error: "Tu cuenta fue bloqueada por el editor." }, { status: 403 });
  }

  const { story, body, author } = (await req.json()) as {
    story?: string; body?: string; author?: string;
  };
  const clean = (body ?? "").trim();
  if (!story || clean.length < 1 || clean.length > 1000) {
    return NextResponse.json({ error: "comentario inválido" }, { status: 400 });
  }

  const { error } = await admin.from("comments").insert({
    story_key: story,
    user_id: user.user.id,
    author: safeAuthor(rawEmail, author),
    body: clean,
    status: "approved",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Comentario publicado" }, { status: 201 });
}
