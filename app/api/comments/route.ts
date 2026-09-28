import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  ADMIN_EMAIL,
  SUPABASE_CONFIGURED,
} from "@/lib/comments";

export const dynamic = "force-dynamic";

function publicAuthor(author: string): string {
  if (author.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "Editor";
  const [name, domain] = author.split("@");
  if (!domain) return author;
  return `${name.slice(0, 2)}*****@${domain}`;
}

export async function GET(req: NextRequest) {
  // AHORA: Si no está configurado, devolvemos un array vacío, no un error 501.
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ comments: [] });
  }
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

export async function POST(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "comentarios no configurados" }, { status: 501 });
  }
  // ... resto del código sin cambios ...
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no logueado" }, { status: 401 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "error de sistema" }, { status: 500 });

  const { data: user, error: authError } = await admin.auth.getUser(token);
  if (authError || !user.user) {
    return NextResponse.json({ error: "sesión inválida" }, { status: 401 });
  }

  const rawEmail = user.user.email ?? "";
  const { data: bannedByUser } = await admin
    .from("banned_users")
    .select("user_id")
    .eq("user_id", user.user.id)
    .maybeSingle();
  const { data: bannedByEmail } = rawEmail
    ? await admin.from("banned_users").select("user_id").eq("email", rawEmail).maybeSingle()
    : { data: null };
  if (bannedByUser || bannedByEmail) {
    return NextResponse.json({ error: "Bloqueado." }, { status: 403 });
  }

  const { story, body, author } = await req.json();
  if (!story || !body || typeof body !== "string" || body.trim().length < 1) {
    return NextResponse.json({ error: "Inválido" }, { status: 400 });
  }

  const { error } = await admin.from("comments").insert({
    story_key: story,
    user_id: user.user.id,
    author: author || "Usuario",
    body: body.trim(),
    status: "approved",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
