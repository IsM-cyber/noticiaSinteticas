import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  ADMIN_EMAIL,
  SUPABASE_CONFIGURED,
} from "@/lib/comments";

export const dynamic = "force-dynamic";

/** Solo el dueño (ADMIN_EMAIL) puede moderar. */
async function requireAdmin(req: NextRequest) {
  if (!SUPABASE_CONFIGURED || !ADMIN_EMAIL) return null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin().auth.getUser(token);
  if (!data.user || data.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;
  return data.user;
}

/** GET /api/admin/comments — comentarios reportados + usuarios bloqueados */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { data: reported, error } = await supabaseAdmin()
    .from("comments")
    .select("id, story_key, user_id, author, body, status, report_count, reported_at, created_at")
    .gt("report_count", 0)
    .order("reported_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: banned, error: banErr } = await supabaseAdmin()
    .from("banned_users")
    .select("user_id, email, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (banErr) return NextResponse.json({ error: banErr.message }, { status: 500 });

  return NextResponse.json({ reported: reported ?? [], banned: banned ?? [] });
}

/** PATCH /api/admin/comments — acciones del editor */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { id, action } = await req.json();

  if (action === "clear" && id) {
    // descartar los reportes: el comentario sigue publicado
    const { error } = await supabaseAdmin()
      .from("comments")
      .update({ report_count: 0, reported_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ban" && id) {
    // bloquear al autor del comentario reportado
    const { data: c } = await supabaseAdmin()
      .from("comments")
      .select("user_id, author")
      .eq("id", id)
      .maybeSingle();
    if (!c?.user_id) return NextResponse.json({ error: "sin usuario" }, { status: 400 });

    let email = c.author ?? "";
    try {
      const { data: au } = await supabaseAdmin()
        .from("auth.users")
        .select("email")
        .eq("id", c.user_id)
        .single();
      if (au?.email) email = au.email;
    } catch {
      /* si no se puede leer auth.users, queda el nombre visible como referencia */
    }

    const { error: insErr } = await supabaseAdmin()
      .from("banned_users")
      .insert({ user_id: c.user_id, email, reason: "bloqueado por el editor" });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // sus reportes se limpian: la decisión ya está tomada
    await supabaseAdmin()
      .from("comments")
      .update({ report_count: 0, reported_at: null })
      .eq("user_id", c.user_id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "acción inválida" }, { status: 400 });
}

/** DELETE /api/admin/comments?user_id=... — desbloquear a un usuario */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "falta user_id" }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from("banned_users")
    .delete()
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}