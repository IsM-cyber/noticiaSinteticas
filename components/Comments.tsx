"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSession, subscribe, startSession, endSession, getToken, validate } from "@/lib/auth-store";
import { maskAuthor } from "@/lib/comments-client";

type CommentItem = {
  id: number;
  author: string;
  body: string;
  created_at: string;
};

export default function Comments({ storyKey }: { storyKey: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  // Sesion compartida: si te logueas en el chat, los comentarios se enteran al instante.
  const sesion = useSyncExternalStore(subscribe, getSession, () => null);
  const email = sesion?.email ?? "";
  const [body, setBody] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authNick, setAuthNick] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const nickname = sesion?.nickname ?? "";
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  // El formulario de ingreso no esta siempre a la vista: aparece recien cuando se
  // intenta comentar sin sesion, no antes.
  const [showAuth, setShowAuth] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);

  // El panel se abre en el momento del intento, y el campo de nombre queda
  // debajo de la vista: sin esto hay que scrollear a mano para encontrarlo. El
  // foco lo trae de una y de paso lo deja listo para escribir.
  useEffect(() => {
    if (authMode === "signup" && showAuth) nickRef.current?.focus();
  }, [authMode, showAuth]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?story=${encodeURIComponent(storyKey)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch { /* la página nunca se rompe por esto */ }
  }, [storyKey]);

  useEffect(() => {
    // Valida el token guardado y publica la sesion en el store compartido:
    // el chat y los comentarios ven el mismo login al instante.
    void validate();
  }, []);

  const toggle = async () => {
    if (!open && !loaded) { setLoaded(true); await load(); }
    setOpen((o) => !o);
  };

  // Los comentarios se releen cada 8s mientras el panel esta abierto: si no,
  // lo que escribe otra maquina no aparece hasta que recargues a mano. El
  // chat ya refresca cada 3s por el mismo motivo.
  useEffect(() => {
    if (!open || !loaded) return;
    const id = setInterval(() => { void load(); }, 8000);
    return () => clearInterval(id);
  }, [open, loaded, load]);

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
      if (!data.token) { setNotice("✅ Cuenta creada. Ahora iniciá sesión."); return; }
      startSession({ email: data.email, nickname: data.nickname ?? "" }, data.token);
    } catch { setNotice("⚠️ No se pudo conectar con el servidor."); }
    setLoading(false);
  };

  const submitComment = async () => {
    if (!body.trim()) return;
    // Sin sesion el formulario se abre en el momento del intento, no de antemano.
    if (!email) {
      setShowAuth(true);
      setNotice("Ingresá para comentar.");
      return;
    }
    const token = getToken();
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ story: storyKey, body }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(`⚠️ ${data.error ?? "No se pudo publicar"}`); return; }
      setBody("");
      setNotice("Comentario publicado.");
      load();
    } catch { setNotice("⚠️ Error de red."); }
    setLoading(false);
  };

  const logout = () => { endSession(); };

  return (
    <div className="comments-wrap">
      <button className="comments-toggle" onClick={toggle}>
        💬 Comentarios{comments.length > 0 ? ` (${comments.length})` : ""}
      </button>

      {open && (
        <section className="comments">
          <div className="comments-head">
            <h3>Comentarios</h3>
            <button className="comments-link" onClick={() => setOpen(false)}>ocultar ✕</button>
          </div>

          {comments.length === 0
            ? <p className="comments-empty">Todavía no hay comentarios. ¡Animate!</p>
            : (
              <ul className="comments-list">
                {comments.map((c) => (
                  <li key={c.id}>
                    <div className="comments-meta">
                      <strong>{c.author}</strong>
                      <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
                    </div>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
            )}

          {email && (
            <p className="comments-auth-line">Conectado como <strong>{nickname || maskAuthor(email)}</strong> <button type="button" onClick={logout} className="comments-link">salir</button></p>
          )}
    
          {!email && showAuth && (
            <div className="comments-auth">
              <p>Ingresá para comentar:</p>
              <input type="email" placeholder="tu@email.com" value={authEmail} autoComplete="email"
                onChange={(e) => setAuthEmail(e.target.value)} />
              <input type="password" placeholder="contraseña (mín. 6)" value={authPass} autoComplete="current-password"
                onChange={(e) => setAuthPass(e.target.value)} />
              {authMode === "signup" ? (
                <>
                  <input ref={nickRef} type="text" placeholder="nombre de usuario" value={authNick} maxLength={20}
                    autoComplete="nickname" onChange={(e) => setAuthNick(e.target.value)} />
                  <div className="comments-buttons">
                    <button type="button" onClick={() => { setAuthMode("login"); setNotice(""); }} disabled={loading}>Volver</button>
                    <button type="button" onClick={() => void submitAuth("signup")} disabled={loading}>Crear cuenta</button>
                  </div>
                </>
              ) : (
                <div className="comments-buttons">
                  <button type="button" onClick={() => void submitAuth("login")} disabled={loading}>Entrar</button>
                  <button type="button" onClick={() => { setAuthMode("signup"); setNotice(""); }} disabled={loading}>Crear cuenta</button>
                </div>
              )}
            </div>
          )}
    
          <div className="comments-auth">
            <textarea rows={3} placeholder="Comentario..." value={body} maxLength={1000}
              onChange={(e) => setBody(e.target.value)} />
            <div className="comments-buttons">
              <button type="button" onClick={submitComment} disabled={loading || !body.trim()}>Comentar</button>
            </div>
          </div>

          {notice && <p className="comments-notice">{notice}</p>}
        </section>
      )}
    </div>
  );
}
