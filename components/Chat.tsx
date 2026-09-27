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
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // Solo renderizamos si el cliente es seguro
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setReady(true); // Ya estamos en el navegador
    
    // Inicialización segura dentro de useEffect
    try {
      const sb = supabaseBrowser();
      sb.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession({ email: data.session.user.email ?? "" });
        }
      });
    } catch (e) {
      console.error("Supabase init error (ignorable in local):", e);
    }

    try {
      setNickname(localStorage.getItem("ns_nick") ?? "");
    } catch {}

    load();
    const interval = setInterval(load, 1500);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (e) {}
  }, []);

  // Si no estamos listos, no renderizamos nada que pueda crashear
  if (!ready) return <div style={{ height: '340px' }} />;

  // ... (el resto del render sigue igual)
  const submitAuth = async (mode: "login" | "signup") => {
    setLoading(true);
    setNotice("");
    try {
      const sb = supabaseBrowser();
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
          setShowAuth(false);
          setNotice("");
        } else if (mode === "signup") {
          setNotice("Revisá tu email para confirmar cuenta.");
        }
      }
    } catch (e) {
      setNotice("⚠️ Error de conexión.");
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      await supabaseBrowser().auth.signOut();
      setSession(null);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!session) { setShowAuth(true); setNotice("⚠️ Inicia sesión para chatear."); return; }
    
    const msg = body;
    const authorName = nickname.trim() || maskAuthor(session.email);
    setBody("");
    
    try {
      await fetch(`/api/chat?msg=${encodeURIComponent(msg)}&author=${encodeURIComponent(authorName)}`);
      load();
    } catch (e) { setBody(msg); }
  };

  return (
    <section style={{ marginTop: '32px', padding: '16px', background: '#0e1320', border: '1px solid #223051', borderRadius: '10px' }}>
      <h3 style={{ color: '#00e5ff', margin: '0 0 12px' }}>Chat Global</h3>
      <ul ref={listRef} style={{ height: '340px', overflowY: 'auto', background: '#07090f', padding: '10px', borderRadius: '8px', border: '1px solid #223051', listStyle: 'none', margin: '0 0 15px' }}>
        {messages.map((m) => (
          <li key={m.id} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: '#7f8db0' }}><strong>{m.author}</strong></div>
            <p style={{ margin: '2px 0', color: '#d9e4f5', wordBreak: 'break-word' }}>{m.body}</p>
          </li>
        ))}
      </ul>
      {session && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#7f8db0', marginBottom: '8px' }}>
          <span>Logueado como: <strong>{maskAuthor(session.email)}</strong></span>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Salir</button>
        </div>
      )}
      {session && (
        <input type="text" placeholder="Tu nombre" value={nickname} maxLength={20} onChange={(e) => { setNickname(e.target.value); try { localStorage.setItem("ns_nick", e.target.value); } catch {} }} style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5', fontSize: '0.85rem' }} />
      )}
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Escribí un mensaje..." value={body} onChange={(e) => setBody(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #00e5ff', background: '#07090f', color: '#d9e4f5', boxSizing: 'border-box' }} />
      </form>
      {showAuth && !session && (
        <div style={{ background: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#00e5ff', fontSize: '0.9rem', fontWeight: 'bold' }}>Identificate</span>
            <button onClick={() => setShowAuth(false)} style={{ background: 'none', border: 'none', color: '#7f8db0', cursor: 'pointer' }}>✕</button>
          </div>
          <input type="email" placeholder="tu@email.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5' }} />
          <input type="password" placeholder="contraseña" value={authPass} onChange={(e) => setAuthPass(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #223051', background: '#07090f', color: '#d9e4f5' }} />
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
