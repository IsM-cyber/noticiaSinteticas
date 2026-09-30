import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, nicknameOf } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Valida el token guardado en localStorage y devuelve la identidad. */
export async function GET(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase no configurado en el servidor" }, { status: 501 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "no logueado" }, { status: 401 });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "sesión inválida" }, { status: 401 });

  return NextResponse.json({
    email: data.user.email ?? "",
    id: data.user.id,
    nickname: nicknameOf(data.user),
  });
}
