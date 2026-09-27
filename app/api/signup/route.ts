import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const password = searchParams.get("pass");

  if (!email || !password) return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });

  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ message: "Usuario creado y confirmado", user: data.user.id });
}
