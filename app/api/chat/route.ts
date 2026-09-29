import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, trustedAuthor } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Fallback en memoria SOLO para desarrollo local sin credenciales.
declare global {
  var chatMessages: { id: number; user_id: string; author: string; body: string; created_at: string }[];
}
if (!global.chatMessages) global.chatMessages = [];

/** Identidad del token Bearer. null si no hay sesión válida. */
async function currentUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

/**
 * GET  /api/chat          → últimos 50 mensajes
 * POST /api/chat          → { body }  (autor sale de la sesion)
 *
 * Antes se enviaba por GET (?msg=) para esquivar CORS; con el proxy de
 * servidor ya no hace falta y además el GET era mutante.
 */
export async function GET(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ messages: global.chatMessages });

  const { data, error } = await admin
    .from("chat_messages")
    .select("id, user_id, author, body, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { body } = (await req.json()) as { body?: string };

  const clean = (body ?? "").trim();
  if (clean.length < 1 || clean.length > 500) {
    return NextResponse.json({ error: "El mensaje debe tener entre 1 y 500 caracteres" }, { status: 400 });
  }

  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Iniciá sesión para chatear" }, { status: 401 });

  // El autor sale de la SESION verificada, no del body: asi nadie escribe en
  // nombre de otro. Si la cuenta no tiene nickname, cae al email enmascarado.
  const visible = trustedAuthor(user);

  const admin = supabaseAdmin();
  if (!admin) {
    // Local sin credenciales: guardamos en memoria para poder probar.
    global.chatMessages.push({
      id: Date.now(), user_id: user.id, author: visible,
      body: clean, created_at: new Date().toISOString(),
    });
    if (global.chatMessages.length > 50) global.chatMessages.shift();
    return NextResponse.json({ ok: true });
  }

  // chat_messages.user_id es NOT NULL: siempre mandamos el id real.
  const { error } = await admin
    .from("chat_messages")
    .insert({ user_id: user.id, author: visible, body: clean });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
