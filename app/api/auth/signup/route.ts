import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Registro vía servidor: el navegador no puede llamar a Supabase (DNS bloqueado). */
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase no configurado en el servidor" },
      { status: 501 },
    );
  }

  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    return NextResponse.json(
      { error: "Faltan email o contraseña" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }

  // Con la service key hay que usar admin.createUser con email_confirm: true.
  // auth.signUp() NO auto-confirma con la service key: exigía confirmar el email
  // y el usuario se quedaba sin poder iniciar sesión.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    const msg = /already registered|already exists/i.test(error.message)
      ? "Ese email ya tiene cuenta. Probá iniciar sesión."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // createUser no devuelve sesión: iniciar sesión explícitamente para que el
  // cliente quede adentro sin pedirle al usuario que vuelva a escribir la clave.
  const { data: login, error: loginError } = await admin.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) {
    return NextResponse.json(
      { error: "Cuenta creada. Ahora iniciá sesión." },
      { status: 200 },
    );
  }
  return NextResponse.json(
    { token: login.session?.access_token, email: data.user?.email ?? email },
    { status: 201 },
  );
}
