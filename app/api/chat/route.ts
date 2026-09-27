import { NextRequest, NextResponse } from "next/server";

// Base de datos local en memoria (global del proceso Node)
declare global {
  var chatMessages: { id: number; author: string; body: string; created_at: string }[];
}

if (!global.chatMessages) {
  global.chatMessages = [
    { id: 1, author: "Sistema", body: "Chat Local Activo", created_at: new Date().toISOString() }
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const msg = searchParams.get("msg");
  const author = searchParams.get("author");
  
  if (msg) {
    const newMsg = {
      id: Date.now(),
      author: author ? author.slice(0, 30) : "Usuario",
      body: msg.slice(0, 500),
      created_at: new Date().toISOString()
    };
    global.chatMessages.push(newMsg);
    if (global.chatMessages.length > 50) global.chatMessages.shift();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ messages: global.chatMessages });
}
