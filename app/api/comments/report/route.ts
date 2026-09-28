import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/comments";

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "no configurado" }, { status: 501 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const { data: c } = await admin.from("comments").select("report_count").eq("id", id).single();
  if (c) {
    await admin.from("comments").update({ 
      report_count: (c.report_count ?? 0) + 1,
      status: "reported",
      reported_at: new Date().toISOString()
    }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
