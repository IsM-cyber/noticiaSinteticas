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
  const [enabled, setEnabled] = useState(COMMENTS_CONFIGURED);
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [body, setBody] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?story=${encodeURIComponent(storyKey)}`);
      if (res.status === 501) {
        setEnabled(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      /* sin comentarios, sin drama */
    }
  }, [storyKey]);

  useEffect(() => {
    if (!COMMENTS_CONFIGURED) {
      setEnabled(false);
      return;
    }
    // la sesión es local y barata; la lista de comentarios se baja recién al abrir
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({
          email: data.session.user.email ?? "",
          token: data.session.access_token,
        });
      }
    });
    // nombre visible elegido por el usuario (persiste en su navegador)
    try {
      setNickname(localStorage.getItem("ns_nick") ?? "");
    } catch {
      /* sin localStorage, sin drama */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;

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
    const sb = supabaseBrowser();
    const result =
      mode === "signup"
        ? await sb.auth.signUp({ email: authEmail, password: authPass })
        : await sb.auth.signInWithPassword({ email: authEmail, password: authPass });
    setLoading(false);
    if (result.error) {
      setNotice(`⚠️ ${result.error.message}`);
      return;
    }
    const ses = await sb.auth.getSession();
    if (ses.data.session) {
      setSession({ email: ses.data.session.user.email ?? "", token: ses.data.session.access_token });
      setNotice(mode === "signup" ? "Cuenta creada. Ya podés comentar." : "Sesión iniciada.");
    } else if (mode === "signup") {
      setNotice("Revisá tu email para confirmar la cuenta.");
    }
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
        load(); // publicación instantánea: el comentario aparece ya
      }
    } catch {
      setNotice("Error de red. Probá de nuevo.");
    }
    setLoading(false);
  };

  const report = async (id: number) => {
    await fetch("/api/comments/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    setSession(null);
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
            <button className="comments-link" onClick={() => setOpen(false)}>
              ocultar ✕
            </button>
          </div>
          {comments.length === 0 && <p className="comments-empty">Todavía no hay comentarios. ¡Animate!</p>}
      <ul className="comments-list">
        {comments.map((c) => (
          <li key={c.id}>
            <div className="comments-meta">
              <strong>{maskAuthor(c.author)}</strong>
              <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
              <button onClick={() => report(c.id)} title="Reportar comentario">⚑</button>
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

      {!session ? (
        <div className="comments-auth">
          <p>Ingresá para comentar:</p>
          <input
            type="email"
            placeholder="tu@email.com"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="contraseña"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
          />
          <div className="comments-buttons">
            <button onClick={() => submitAuth("login")} disabled={loading}>
              Entrar
            </button>
            <button onClick={() => submitAuth("signup")} disabled={loading}>
              Crear cuenta
            </button>
          </div>
          <p className="comments-hint">
            La primera vez tocá «Crear cuenta». Los comentarios se publican al instante. Si ves algo raro, reportalo con ⚑.
          </p>
        </div>
      ) : (
        <div className="comments-auth">
          <p>
            Logueado como {maskAuthor(session.email)}{" "}
            <button onClick={logout} className="comments-link">salir</button>
          </p>
          <input
            type="text"
            maxLength={30}
            placeholder="Tu nombre (lo ven los demás)"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              try {
                localStorage.setItem("ns_nick", e.target.value);
              } catch {
                /* sin localStorage, sin drama */
              }
            }}
          />
          <textarea
            rows={3}
            placeholder="Escribí tu comentario… (máx. 1000 caracteres)"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="comments-buttons">
            <button onClick={submitComment} disabled={loading || !body.trim()}>
              Comentar
            </button>
          </div>
        </div>
      )}
      {notice && <p className="comments-notice">{notice}</p>}
        </section>
      )}
    </div>
  );
}