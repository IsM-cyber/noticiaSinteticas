"use client";

import { useCallback, useEffect, useState } from "react";
import { COMMENTS_CONFIGURED, supabaseBrowser } from "@/lib/comments-client";

type ReportedItem = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  report_count: number;
  reported_at: string | null;
  created_at: string;
};

type BannedItem = {
  user_id: string;
  email: string | null;
  reason: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [reported, setReported] = useState<ReportedItem[]>([]);
  const [banned, setBanned] = useState<BannedItem[]>([]);
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
    setReported(data.reported ?? []);
    setBanned(data.banned ?? []);
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

  const act = async (body: object) => {
    if (!session) return;
    setLoading(true);
    await fetch("/api/admin/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(body),
    });
    await load(session.token);
    setLoading(false);
  };

  const unban = async (userId: string) => {
    if (!session) return;
    setLoading(true);
    await fetch(`/api/admin/comments?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.token}` },
    });
    await load(session.token);
    setLoading(false);
  };

  const login = async () => {
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: prompt("Email del editor:") ?? "",
      options: { emailRedirectTo: window.location.origin + "/admin" },
    });
    setMessage(error ? `⚠️ ${error.message}` : "Revisá tu email para entrar.");
  };

  return (
    <main className="wrap">
      <header className="hero">
        <h1>
          Moderación <span>de comentarios</span>
        </h1>
        <p>Los comentarios se publican solos. Acá gestionás reportes y bloqueos.</p>
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
            Logueado como {session.email} · {reported.length} reportados · {banned.length} bloqueados
          </p>

          <h2 className="admin-section">⚠️ Reportados ({reported.length})</h2>
          {reported.length === 0 && (
            <p className="comments-empty">Sin reportes. ¡Todo al día!</p>
          )}
          <ul className="comments-list">
            {reported.map((c) => (
              <li key={c.id} className="admin-item">
                <div className="comments-meta">
                  <strong>{c.author}</strong>
                  <span>⚑ {c.report_count} reporte(s)</span>
                  <span>{c.reported_at ? new Date(c.reported_at).toLocaleString("es-AR") : ""}</span>
                </div>
                <p>{c.body}</p>
                <p className="comments-hint">Noticia: {c.story_key.slice(0, 70)}…</p>
                <div className="comments-buttons">
                  <button
                    className="admin-ban"
                    onClick={() => {
                      if (confirm("¿Bloquear a este usuario? Sus futuros comentarios serán rechazados.")) {
                        act({ action: "ban", id: c.id });
                      }
                    }}
                    disabled={loading}
                  >
                    🚫 Bloquear usuario
                  </button>
                  <button onClick={() => act({ action: "clear", id: c.id })} disabled={loading}>
                    Descartar reportes
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="admin-section">🚫 Bloqueados ({banned.length})</h2>
          {banned.length === 0 && <p className="comments-empty">Nadie bloqueado por ahora.</p>}
          <ul className="comments-list">
            {banned.map((b) => (
              <li key={b.user_id} className="admin-item">
                <div className="comments-meta">
                  <strong>{b.email || b.user_id}</strong>
                  <span>{b.created_at ? new Date(b.created_at).toLocaleString("es-AR") : ""}</span>
                </div>
                <p className="comments-hint">{b.reason || "—"}</p>
                <div className="comments-buttons">
                  <button onClick={() => unban(b.user_id)} disabled={loading}>
                    Desbloquear
                  </button>
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