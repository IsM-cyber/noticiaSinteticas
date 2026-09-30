import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Login vía servidor: el navegador no puede llamar a Supabase (DNS bloqueado). */
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase no configurado en el servidor" }, { status: 501 });

  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ error: "Faltan email o contraseña" }, { status: 400 });

  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });

  return NextResponse.json({
    token: data.session.access_token,
    email: data.user.email ?? email,
  });
}
