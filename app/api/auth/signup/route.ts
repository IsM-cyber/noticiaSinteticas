import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Registro vía servidor: el navegador no puede llamar a Supabase (DNS bloqueado). */
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase no configurado en el servidor" }, { status: 501 });

  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ error: "Faltan email o contraseña" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  // La service key auto-confirma el email, así que no hay flujo de verificación.
  const { data, error } = await admin.auth.signUp({ email, password });
  if (error) {
    const msg = /already registered|already exists/i.test(error.message)
      ? "Ese email ya tiene cuenta. Probá iniciar sesión."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const token = data.session?.access_token;
  if (!token) {
    return NextResponse.json({ error: "Cuenta creada. Ahora iniciá sesión." }, { status: 200 });
  }
  return NextResponse.json({ token, email: data.user?.email ?? email }, { status: 201 });
}
