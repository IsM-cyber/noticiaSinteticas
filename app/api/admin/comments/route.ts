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

/** GET /api/admin/comments — todos los pendientes y reportados */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("comments")
    .select("id, story_key, author, body, status, created_at")
    .in("status", ["pending", "reported"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data });
}

/** PATCH /api/admin/comments — aprobar, rechazar o marcar reportado */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !["approved", "rejected", "reported"].includes(status)) {
    return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  }
  const { error } = await supabaseAdmin()
    .from("comments")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}