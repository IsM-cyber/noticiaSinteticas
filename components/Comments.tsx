"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMMENTS_CONFIGURED,
  maskAuthor,
  supabaseBrowser,
} from "@/lib/comments-client";

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
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [body, setBody] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?story=${encodeURIComponent(storyKey)}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch { /* sin comentarios */ }
  }, [storyKey]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (sb) {
      sb.auth.getSession().then(({ data }) => {
        if (data.session && data.session.user) {
          setSession({
            email: data.session.user.email ?? "",
            token: data.session.access_token,
          });
        }
      });
    }
  }, []);

  const toggle = async () => {
    if (!open && !loaded) {
      setLoaded(true);
      await load();
    }
    setOpen((o) => !o);
  };

  const submitAuth = async (mode: "login" | "signup") => {
    setLoading(true);
    setNotice("");
    
    // USAMOS EL SERVIDOR PARA EVITAR CORS/RED
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPass }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setNotice(`⚠️ Error: ${data.error || 'Fallo en autenticación'}`);
        setLoading(false);
        return;
      }
      
      // Si login exitoso, recargar para obtener sesión
      if (mode === "login") {
        window.location.reload();
      } else {
        setNotice("Cuenta creada. Ahora iniciá sesión.");
      }
    } catch (e) {
      setNotice(`⚠️ Error de red: ${e instanceof Error ? e.message : 'Desconocido'}`);
    }
    setLoading(false);
  };

  const submitComment = async () => {
    if (!session) return;
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ story: storyKey, body, author: nickname }),
      });
      const data = await res.json();
      setNotice(data.message ?? data.error ?? "Error");
      if (res.ok) {
        setBody("");
        load();
      }
    } catch {
      setNotice("Error de red.");
    }
    setLoading(false);
  };

  const logout = async () => {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    window.location.reload();
  };

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
          {comments.length === 0 && <p className="comments-empty">Todavía no hay comentarios.</p>}
          <ul className="comments-list">
            {comments.map((c) => (
              <li key={c.id}>
                <div className="comments-meta">
                  <strong>{maskAuthor(c.author)}</strong>
                  <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
                </div>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
          {!session ? (
            <div className="comments-auth">
              <p>Ingresá para comentar:</p>
              <input type="email" placeholder="tu@email.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <input type="password" placeholder="contraseña" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
              <div className="comments-buttons">
                <button onClick={() => submitAuth("login")} disabled={loading}>Entrar</button>
                <button onClick={() => submitAuth("signup")} disabled={loading}>Crear cuenta</button>
              </div>
            </div>
          ) : (
            <div className="comments-auth">
              <p>Logueado como {maskAuthor(session.email)} <button onClick={logout} className="comments-link">salir</button></p>
              <input type="text" maxLength={30} placeholder="Tu nombre" value={nickname} onChange={(e) => { setNickname(e.target.value); }} />
              <textarea rows={3} placeholder="Comentario..." value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
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
