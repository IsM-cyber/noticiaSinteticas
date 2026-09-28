import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, SUPABASE_CONFIGURED } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ reported: [], banned: [] });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { data: user } = await admin.auth.getUser(token);
  if (!user.user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { data: reported, error: rErr } = await admin.from("comments").select("*").eq("status", "reported");
  const { data: banned, error: bErr } = await admin.from("banned_users").select("*");

  if (rErr || bErr) return NextResponse.json({ error: "error DB" }, { status: 500 });
  return NextResponse.json({ reported: reported ?? [], banned: banned ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "no configurado" }, { status: 501 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { action, id } = await req.json();
  if (action === "ban") {
    // Lógica de baneo...
    const { data: c } = await admin.from("comments").select("user_id").eq("id", id).single();
    if (c?.user_id) await admin.from("banned_users").insert({ user_id: c.user_id });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "no configurado" }, { status: 501 });
  
  const userId = req.nextUrl.searchParams.get("user_id");
  if (userId) await admin.from("banned_users").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
