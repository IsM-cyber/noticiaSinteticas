import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/comments";

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "no configurado" }, { status: 501 });

  const { email, password } = await req.json();
  
  const { data, error } = await admin.auth.signUp({ email, password });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 200 });
}
