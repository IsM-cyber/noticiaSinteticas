"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  maskAuthor,
  supabaseBrowser,
} from "@/lib/comments-client";

type ChatMessage = {
  id: number;
  author: string;
  body: string;
  created_at: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false); // Se despliega solo si intenta chatear sin sesión
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (e) { /* Silencioso */ }
  }, []);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({ email: data.session.user.email ?? "" });
      }
    });

    try {
      setNickname(localStorage.getItem("ns_nick") ?? "");
    } catch { /* sin localStorage */ }

    load();
    const interval = setInterval(load, 1500);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const submitAuth = async (mode: "login" | "signup") => {
    setLoading(true);
    setNotice("");
    const sb = supabaseBrowser();
    try {
      const result =
        mode === "signup"
          ? await sb.auth.signUp({ email: authEmail, password: authPass })
          : await sb.auth.signInWithPassword({ email: authEmail, password: authPass });
      
      if (result.error) {
        setNotice(`⚠️ ${result.error.message}`);
      } else {
        const ses = await sb.auth.getSession();
        if (ses.data.session) {
          setSession({ email: ses.data.session.user.email ?? "" });
          setShowAuth(false); // Ocultar caja al loguearse con éxito
          setNotice("");
        } else if (mode === "signup") {
          setNotice("Revisá tu email para confirmar cuenta.");
        }
      }
    } catch (e) {
      setNotice("⚠️ Error de conexión con Supabase.");
    }
    setLoading(false);
  };

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    setSession(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    
    // Si NO está logueado, interceptamos e impedimos el envío, desplegando la caja de diálogo
    if (!session) {
      setShowAuth(true);
      setNotice("⚠️ Tenés que iniciar sesión o crear una cuenta para enviar mensajes.");
      return;
    }
    
    const msg = body;
    const authorName = nickname.trim() || maskAuthor(session.email);
    setBody("");
    setNotice("");
    
    try {
      await fetch(`/api/chat?msg=${encodeURIComponent(msg)}&author=${encodeURIComponent(authorName)}`);
      load();
    } catch (e) {
      setBody(msg);
    }
  };

  return (
    <section style={{ marginTop: '32px', padding: '16px', background: '#0e1320', border: '1px solid #223051', borderRadius: '10px' }}>
      <h3 style={{ color: '#00e5ff', margin: '0 0 12px' }}>Chat Global</h3>
      
      {/* Lista de mensajes siempre visible */}
      <ul ref={listRef} style={{ height: '340px', overflowY: 'auto', background: '#07090f', padding: '10px', borderRadius: '8px', border: '1px solid #223051', listStyle: 'none', margin: '0 0 15px' }}>
        {messages.map((m) => (
          <li key={m.id} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: '#7f8db0' }}><strong>{m.author}</strong></div>
            <p style={{ margin: '2px 0', color: '#d9e4f5', wordBreak: 'break-word' }}>{m.body}</p>
          </li>
        ))}
      </ul>

      {/* Panel de usuario logueado */}
      {session && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#7f8db0', marginBottom: '8px' }}>
          <span>Logueado como: <strong>{maskAuthor(session.email)}</strong></span>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Salir</button>
        </div>
      )}

      {/* Input de apodo opcional si está logueado */}
      {session && (
        <input
          type="text"
          placeholder="Tu nombre en el chat (opcional)"
          value={nickname}
          maxLength={20}
          onChange={(e) => {
            setNickname(e.target.value);
            try { localStorage.setItem("ns_nick", e.target.value); } catch {}
          }}
          style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5', fontSize: '0.85rem' }}
        />
      )}

      {/* Caja de chat siempre disponible como primera opción */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Escribí un mensaje..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #00e5ff', background: '#07090f', color: '#d9e4f5', boxSizing: 'border-box' }}
        />
      </form>

      {/* Caja de diálogo de Autenticación que se despliega SOLA si intentas chatear sin cuenta */}
      {showAuth && !session && (
        <div style={{ background: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#00e5ff', fontSize: '0.9rem', fontWeight: 'bold' }}>Identificate para enviar tu mensaje</span>
            <button onClick={() => setShowAuth(false)} style={{ background: 'none', border: 'none', color: '#7f8db0', cursor: 'pointer' }}>✕</button>
          </div>
          <input
            type="email"
            placeholder="tu@email.com"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5' }}
          />
          <input
            type="password"
            placeholder="contraseña"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => submitAuth("login")} disabled={loading} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#00e5ff', color: '#0e1320', fontWeight: 'bold', cursor: 'pointer' }}>Entrar</button>
            <button onClick={() => submitAuth("signup")} disabled={loading} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #00e5ff', background: 'transparent', color: '#00e5ff', fontWeight: 'bold', cursor: 'pointer' }}>Crear cuenta</button>
          </div>
          {notice && <p style={{ color: '#ff5555', fontSize: '0.8rem', marginTop: '10px' }}>{notice}</p>}
        </div>
      )}
    </section>
  );
}
