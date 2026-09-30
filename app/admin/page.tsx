"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [email, setEmail] = useState("");
  const [reported, setReported] = useState<ReportedItem[]>([]);
  const [banned, setBanned] = useState<BannedItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/comments", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setMessage("No autorizado: este panel es solo del editor."); return; }
    const data = await res.json();
    setReported(data.reported ?? []);
    setBanned(data.banned ?? []);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("ns_token");
    if (!token) return;
    fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.email) { setEmail(d.email); void load(token); } })
      .catch(() => { /* sin sesión */ });
  }, [load]);

  const login = async () => {
    const addr = prompt("Email del editor:");
    if (!addr) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr, password: prompt("Contraseña:") ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(`⚠️ ${data.error}`); return; }
      localStorage.setItem("ns_token", data.token);
      setEmail(data.email);
      await load(data.token);
    } catch { setMessage("⚠️ No se pudo conectar con el servidor."); }
    setLoading(false);
  };

  const act = async (body: object) => {
    const token = localStorage.getItem("ns_token") ?? "";
    setLoading(true);
    await fetch("/api/admin/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    await load(token);
    setLoading(false);
  };

  const unban = async (userId: string) => {
    const token = localStorage.getItem("ns_token") ?? "";
    setLoading(true);
    await fetch(`/api/admin/comments?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load(token);
    setLoading(false);
  };

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Moderación <span>de comentarios</span></h1>
        <p>Los comentarios se publican solos. Acá gestionás reportes y bloqueos.</p>
      </header>

      {!email && (
        <div className="comments-auth">
          <p>Ingresá con el email del editor para moderar:</p>
          <button onClick={login} disabled={loading}>Iniciar sesión</button>
        </div>
      )}

      {email && (
        <>
          <p className="comments-hint">
            Logueado como {email} · {reported.length} reportados · {banned.length} bloqueados
          </p>

          <h2 className="admin-section">⚠️ Reportados ({reported.length})</h2>
          {reported.length === 0 && <p className="comments-empty">Sin reportes. ¡Todo al día!</p>}
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
                  <button className="admin-ban" disabled={loading}
                    onClick={() => { if (confirm("¿Bloquear a este usuario?")) void act({ action: "ban", id: c.id }); }}>
                    🚫 Bloquear usuario
                  </button>
                  <button onClick={() => act({ action: "clear", id: c.id })} disabled={loading}>Descartar reportes</button>
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
                  <button onClick={() => unban(b.user_id)} disabled={loading}>Desbloquear</button>
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
