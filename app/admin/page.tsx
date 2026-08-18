"use client";

import { useCallback, useEffect, useState } from "react";
import { COMMENTS_CONFIGURED, supabaseBrowser } from "@/lib/comments-client";

type AdminItem = {
  id: number;
  story_key: string;
  author: string;
  body: string;
  status: string;
  created_at: string;
};

export default function AdminPage() {
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/comments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("No autorizado: este panel es solo del editor.");
      return;
    }
    const data = await res.json();
    setItems(data.comments ?? []);
  }, []);

  useEffect(() => {
    if (!COMMENTS_CONFIGURED) return;
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (data.session) {
        const ses = { email: data.session.user.email ?? "", token: data.session.access_token };
        setSession(ses);
        load(ses.token);
      }
    });
  }, [load]);

  const moderate = async (id: number, status: string) => {
    if (!session) return;
    setLoading(true);
    await fetch("/api/admin/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ id, status }),
    });
    setItems((prev) => prev.filter((c) => c.id !== id));
    setLoading(false);
  };

  const login = async () => {
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: prompt("Email del editor:") ?? "",
    });
    setMessage(error ? `⚠️ ${error.message}` : "Revisá tu email para entrar.");
  };

  return (
    <main className="wrap">
      <header className="hero">
        <h1>
          Moderación <span>de comentarios</span>
        </h1>
        <p>Panel privado del editor — aprobá o rechazá los comentarios pendientes.</p>
      </header>

      {!session && (
        <div className="comments-auth">
          <p>Ingresá con el email del editor para moderar:</p>
          <button onClick={login}>Enviar link de acceso</button>
        </div>
      )}

      {session && (
        <>
          <p className="comments-hint">
            Logueado como {session.email} · {items.length} pendientes
          </p>
          {items.length === 0 && <p className="comments-empty">Sin comentarios pendientes. ¡Todo al día!</p>}
          <ul className="comments-list">
            {items.map((c) => (
              <li key={c.id}>
                <div className="comments-meta">
                  <strong>{c.author}</strong>
                  <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
                  <span className="category">{c.status}</span>
                </div>
                <p>{c.body}</p>
                <p className="comments-hint">Noticia: {c.story_key.slice(0, 70)}…</p>
                <div className="comments-buttons">
                  <button onClick={() => moderate(c.id, "approved")} disabled={loading}>✓ Aprobar</button>
                  <button onClick={() => moderate(c.id, "rejected")} disabled={loading}>✗ Rechazar</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p className="comments-notice">{message}</p>}
    </main>
  );
}