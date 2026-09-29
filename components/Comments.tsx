"use client";

import { useCallback, useEffect, useState } from "react";
import { maskAuthor } from "@/lib/comments-client";

type CommentItem = {
  id: number;
  author: string;
  body: string;
  created_at: string;
};

const TOKEN_KEY = "ns_token";
const NICK_KEY = "ns_nick";

export default function Comments({ storyKey }: { storyKey: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?story=${encodeURIComponent(storyKey)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch { /* la página nunca se rompe por esto */ }
  }, [storyKey]);

  useEffect(() => {
    try {
      setNickname(localStorage.getItem(NICK_KEY) ?? "");
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.email) setEmail(d.email); else localStorage.removeItem(TOKEN_KEY); })
          .catch(() => { localStorage.removeItem(TOKEN_KEY); });
      }
    } catch { /* sin localStorage */ }
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
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPass }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(`⚠️ ${data.error ?? "No se pudo completar"}`); return; }
      if (!data.token) { setNotice("✅ Cuenta creada. Ahora iniciá sesión."); return; }
      localStorage.setItem(TOKEN_KEY, data.token);
      setEmail(data.email);
    } catch { setNotice("⚠️ No se pudo conectar con el servidor."); }
    setLoading(false);
  };

  const submitComment = async () => {
    if (!body.trim()) return;
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ story: storyKey, body, author: nickname }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(`⚠️ ${data.error ?? "No se pudo publicar"}`); return; }
      setBody("");
      setNotice("Comentario publicado.");
      load();
    } catch { setNotice("⚠️ Error de red."); }
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem(TOKEN_KEY); setEmail(""); };

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

          {!email ? (
            <div className="comments-auth">
              <p>Ingresá para comentar:</p>
              <input type="email" placeholder="tu@email.com" value={authEmail} autoComplete="email"
                onChange={(e) => setAuthEmail(e.target.value)} />
              <input type="password" placeholder="contraseña (mín. 6)" value={authPass} autoComplete="current-password"
                onChange={(e) => setAuthPass(e.target.value)} />
              <div className="comments-buttons">
                <button onClick={() => submitAuth("login")} disabled={loading}>Entrar</button>
                <button onClick={() => submitAuth("signup")} disabled={loading}>Crear cuenta</button>
              </div>
            </div>
          ) : (
            <div className="comments-auth">
              <p>Conectado como {maskAuthor(email)} <button onClick={logout} className="comments-link">salir</button></p>
              <input type="text" maxLength={30} placeholder="Tu nombre" value={nickname}
                onChange={(e) => { setNickname(e.target.value); try { localStorage.setItem(NICK_KEY, e.target.value); } catch {} }} />
              <textarea rows={3} placeholder="Comentario..." value={body} maxLength={1000}
                onChange={(e) => setBody(e.target.value)} />
              <div className="comments-buttons">
                <button onClick={submitComment} disabled={loading || !body.trim()}>Comentar</button>
              </div>
            </div>
          )}

          {notice && <p className="comments-notice">{notice}</p>}
        </section>
      )}
    </div>
  );
}
