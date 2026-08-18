import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_CONFIGURED } from "@/lib/comments";

export const dynamic = "force-dynamic";

/** POST /api/comments/report — cualquier visitante reporta un comentario */
export async function POST(req: NextRequest) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "no configurado" }, { status: 501 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from("comments")
    .update({ status: "reported" })
    .eq("id", id)
    .eq("status", "approved");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}