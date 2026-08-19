import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  ADMIN_EMAIL,
  SUPABASE_CONFIGURED,
} from "@/lib/comments";

export const dynamic = "force-dynamic";

/**
 * Nombre público de un comentario:
 * - el editor se muestra como "Editor" (su email jamás sale del servidor)
 * - los demás: "ab*****@gmail.com" (ofuscado, nunca el email completo)
 */
function publicAuthor(author: string): string {
  if (author.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "Editor";
  const [name, domain] = author.split("@");
  if (!domain) return author;
  return `${name.slice(0, 2)}*****@${domain}`;
}

/** GET /api/comments?story=CLAVE — comentarios aprobados de una noticia */
export async function GET(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "comentarios no configurados" }, { status: 501 });
  }
  const story = req.nextUrl.searchParams.get("story") ?? "";
  if (!story) return NextResponse.json({ error: "falta story" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
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

/** POST /api/comments — crear comentario (requiere sesión activa) */
export async function POST(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "comentarios no configurados" }, { status: 501 });
  }
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no logueado" }, { status: 401 });

  const { data: user, error: authError } = await supabaseAdmin().auth.getUser(token);
  if (authError || !user.user) {
    return NextResponse.json({ error: "sesión inválida" }, { status: 401 });
  }

  const { story, body } = await req.json();
  if (!story || !body || typeof body !== "string" || body.trim().length < 1 ||
      body.trim().length > 1000) {
    return NextResponse.json({ error: "comentario inválido" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("comments").insert({
    story_key: story,
    user_id: user.user.id,
    author: user.user.email ?? "anónimo",
    body: body.trim(),
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Comentario enviado. Se publica cuando el editor lo apruebe." }, { status: 201 });
}