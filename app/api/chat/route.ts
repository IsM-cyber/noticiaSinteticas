import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Detectamos si tenemos las credenciales de Supabase (Vercel las tiene)
const isCloud = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = isCloud 
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  : null;

// Memoria local (solo para desarrollo offline)
declare global {
  var chatMessages: { id: number; author: string; body: string; created_at: string }[];
}
if (!global.chatMessages) global.chatMessages = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const msg = searchParams.get("msg");
  const author = searchParams.get("author");

  // MODO CLOUD (SUPABASE)
  if (supabase) {
    if (msg) {
      const { error } = await supabase.from("chat_messages").insert([{ author: author || "Usuario", body: msg }]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    const { data, error } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data });
  }

  // MODO LOCAL (MEMORIA)
  if (msg) {
    global.chatMessages.push({ id: Date.now(), author: author || "Usuario", body: msg, created_at: new Date().toISOString() });
    if (global.chatMessages.length > 50) global.chatMessages.shift();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ messages: global.chatMessages });
}
