"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSession, subscribe, startSession, endSession, getToken, validate } from "@/lib/auth-store";
import { maskAuthor } from "@/lib/comments-client";

type ChatMessage = {
  id: number;
  author: string;
  body: string;
  created_at: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  // Sesion compartida: si te logueas en comentarios, el chat se entera al instante.
  const sesion = useSyncExternalStore(subscribe, getSession, () => null);
  const email = sesion?.email ?? "";
  const nickname = sesion?.nickname ?? "";
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authNick, setAuthNick] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages((data.messages ?? []).slice().reverse());
    } catch { /* silencioso: la página nunca debe romperse */ }
  }, []);

      useEffect(() => {
        setReady(true);
        // Valida el token guardado y publica la sesion en el store compartido:
        // el chat y los comentarios ven el mismo login al instante.
        void validate();

        load();
        const interval = setInterval(load, 3000);
        return () => clearInterval(interval);
      }, [load]);

  // La seccion del chat tiene su propio scroll (esta dentro de un sidebar
  // sticky, asi que scrollear la pagina no alcanza). Al abrir el panel y al
  // pasar a modo "Crear cuenta" hay que traerlo a la vista: el campo de nombre
  // de usuario queda por debajo del pliegue si no.
  useEffect(() => {
    if (!showAuth) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showAuth, authMode]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submitAuth = async (mode: "login" | "signup") => {
    // Aviso local: no tiene sentido pegarle al server sin nombre de usuario.
    if (mode === "signup" && !authNick.trim()) {
      setNotice("⚠️ Escribi un nombre de usuario (2 a 20 caracteres).");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPass,
          nickname: mode === "signup" ? authNick : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(`⚠️ ${data.error ?? "No se pudo completar"}`); return; }
      if (!data.token) { setNotice(`✅ ${data.error ?? "Cuenta creada. Ya podés iniciar sesión."}`); return; }
      startSession({ email: data.email, nickname: data.nickname ?? "" }, data.token);
      setShowAuth(false);
    } catch { setNotice("⚠️ No se pudo conectar con el servidor."); }
    setLoading(false);
  };

  const logout = () => {
    endSession();
  };

  const send = async () => {
    const clean = body.trim();
    if (!clean) return;
    if (!email) { setShowAuth(true); setNotice("Iniciá sesión para chatear."); return; }
    const token = getToken();

    setBody("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: clean }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setBody(clean);
        setNotice(`⚠️ ${d.error ?? "No se pudo enviar"}`);
        return;
      }
      load();
    } catch { setBody(clean); setNotice("⚠️ Error de red."); }
  };

  // Antes: if (!ready) return null. Con eso, si el JS no cargaba o fallaba
      // la hidratacion, el chat no se veia nunca y sin mostrar ningun error.
      // Ahora el marco se dibuja siempre y el estado va adentro.

  return (
    <section style={{ marginTop: 32, padding: 16, background: "#0e1320", border: "1px solid #223051", borderRadius: 10, maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}>
      <h3 style={{ color: "#00e5ff", margin: "0 0 12px" }}>Chat global</h3>

        {!ready && (
          <p style={{ color: "#7f8db0", fontSize: "0.8rem", margin: 0 }}>
            Cargando chat…
          </p>
        )}

      <ul ref={listRef} style={{ height: 300, overflowY: "auto", background: "#07090f", padding: 10, borderRadius: 8, border: "1px solid #223051", listStyle: "none", margin: "0 0 12px" }}>
        {messages.length === 0 && (
          <li style={{ color: "#7f8db0", fontSize: "0.85rem" }}>Todavía no hay mensajes.</li>
        )}
        {messages.map((m) => (
          <li key={m.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "0.75rem", color: "#7f8db0" }}>
              <strong>{m.author}</strong> · {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <p style={{ margin: "2px 0", color: "#d9e4f5", wordBreak: "break-word" }}>{m.body}</p>
          </li>
        ))}
      </ul>

      {email ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#7f8db0", marginBottom: 8 }}>
          <span>Conectado como <strong>{maskAuthor(email)}</strong></span>
          <button onClick={logout} style={{ background: "none", border: "none", color: "#00e5ff", cursor: "pointer", padding: 0 }}>salir</button>
        </div>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "#7f8db0", margin: "0 0 8px" }}>
          <button onClick={() => { setShowAuth(true); setNotice(""); }} style={{ background: "none", border: "none", color: "#00e5ff", cursor: "pointer", padding: 0 }}>
            Iniciá sesión para chatear
          </button>
        </p>
      )}

      {email && (
        <div style={{ marginBottom: 8, fontSize: "0.8rem", color: "#7f8db0" }}>
          Hablando como <strong style={{ color: "#00e5ff" }}>{nickname || email}</strong>
        </div>
      )}

      {/* <form> nativo: Enter envía de forma nativa y confiable */}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input
          type="text" placeholder="Escribí un mensaje..." value={body} maxLength={500}
          onChange={(e) => setBody(e.target.value)}
          style={{ width: "100%", padding: 10, boxSizing: "border-box", borderRadius: 6, border: "1px solid #00e5ff", background: "#07090f", color: "#d9e4f5" }}
        />
      </form>

      {notice && <p style={{ color: "#ffb86b", fontSize: "0.8rem", margin: "10px 0 0" }}>{notice}</p>}

      {showAuth && !email && (
        <div ref={panelRef} style={{ background: "#161b22", padding: 15, borderRadius: 8, border: "1px solid #30363d", marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#00e5ff", fontSize: "0.9rem", fontWeight: 700 }}>Logueate</span>
            <button onClick={() => setShowAuth(false)} style={{ background: "none", border: "none", color: "#7f8db0", cursor: "pointer" }}>✕</button>
          </div>
          <input type="email" placeholder="tu@email.com" value={authEmail} autoComplete="email"
            onChange={(e) => setAuthEmail(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box", borderRadius: 6, border: "1px solid #223051", background: "#07090f", color: "#d9e4f5" }} />
          <input type="password" placeholder="contraseña (mín. 6)" value={authPass} autoComplete="current-password"
            onChange={(e) => setAuthPass(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10, boxSizing: "border-box", borderRadius: 6, border: "1px solid #223051", background: "#07090f", color: "#d9e4f5" }} />
              {authMode === "signup" ? (
                <>
                  <input type="text" placeholder="nombre de usuario" value={authNick} maxLength={20}
                    autoComplete="nickname" onChange={(e) => setAuthNick(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box", borderRadius: 6, border: "1px solid #223051", background: "#07090f", color: "#d9e4f5" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setAuthMode("login"); setNotice(""); }} disabled={loading}
                      style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #223051", background: "transparent", color: "#7f8db0", fontWeight: 700, cursor: "pointer" }}>Volver</button>
                    <button onClick={() => void submitAuth("signup")} disabled={loading}
                      style={{ flex: 1, padding: 8, borderRadius: 6, border: "none", background: "#00e5ff", color: "#0e1320", fontWeight: 700, cursor: "pointer" }}>Crear cuenta</button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => void submitAuth("login")} disabled={loading}
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: "none", background: "#00e5ff", color: "#0e1320", fontWeight: 700, cursor: "pointer" }}>Entrar</button>
                  <button onClick={() => { setAuthMode("signup"); setNotice(""); }} disabled={loading}
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #00e5ff", background: "transparent", color: "#00e5ff", fontWeight: 700, cursor: "pointer" }}>Crear cuenta</button>
                </div>
              )}
        </div>
      )}
    </section>
  );
}
