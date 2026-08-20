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

  const { data: row } = await supabaseAdmin()
    .from("comments")
    .select("id, report_count")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const { error } = await supabaseAdmin()
    .from("comments")
    .update({
      report_count: (row.report_count ?? 0) + 1,
      reported_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}