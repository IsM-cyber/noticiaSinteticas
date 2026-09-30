"use client";

import { useEffect, useRef, useState } from "react";
import { startSession } from "@/lib/auth-store";

/**
 * Ventana flotante de ingreso. La usan el chat y los comentarios.
 *
 * Antes cada componente tenia su propia copia del formulario, dibujada en la
 * pagina. Eso rompia de dos maneras: los comentarios se olvidaban del scroll que
 * el chat si hacia, y depender de un scroll de ventana sobre un documento de
 * 24.000px con sidebar sticky hacia que el campo de nombre quedara fuera de
 * pantalla (o llegara segundos despues, con el scroll suave todavia en camino).
 *
 * Va flotante y centrado porque el formulario aparece en el momento en que la
 * persona intenta actuar sin sesion: en ese momento tiene que estar SIEMPRE a la
 * vista, sin depender de donde este scrolleada la pagina.
 */
export default function AuthPanel({
  titulo,
  onClose,
}: {
  /** "Ingresá para chatear" / "Ingresá para comentar" */
  titulo: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nick, setNick] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nickRef = useRef<HTMLInputElement>(null);

  // El foco es lo que hace que el navegador traiga el campo a la vista por su
  // cuenta, sin depender de ninguna animacion de scroll nuestra.
  useEffect(() => {
    (mode === "signup" ? nickRef.current : emailRef.current)?.focus();
  }, [mode]);

  // Escape cierra. Y la pagina de fondo no se scrollea con la rueda del mouse
  // mientras el formulario esta abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [onClose, loading]);

  const submit = async (que: "login" | "signup") => {
    // Se valida lo mismo que el servidor, para no gastar un round-trip en
    // mostrar un error que ya conocemos.
    if (que === "signup") {
      const limpio = nick.trim();
      if (limpio.length < 2 || limpio.length > 20) {
        setNotice("⚠️ Escribí un nombre de usuario de 2 a 20 caracteres.");
        nickRef.current?.focus();
        return;
      }
      if (!/^[\p{L}\p{N}_ .-]+$/u.test(limpio)) {
        setNotice("⚠️ Solo letras, números, espacios, guiones, puntos o guiones bajos.");
        nickRef.current?.focus();
        return;
      }
    }
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch(`/api/auth/${que}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: pass,
          nickname: que === "signup" ? nick.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(`⚠️ ${data.error ?? "No se pudo completar"}`);
        return;
      }
      if (!data.token) {
        setNotice(`✅ ${data.error ?? "Cuenta creada. Ya podés iniciar sesión."}`);
        setMode("login");
        return;
      }
      startSession({ email: data.email, nickname: data.nickname ?? "" }, data.token);
      onClose();
    } catch {
      setNotice("⚠️ No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const input = {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    boxSizing: "border-box" as const,
    borderRadius: 8,
    border: "1px solid #223051",
    background: "#07090f",
    color: "#d9e4f5",
    font: "inherit",
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4, 7, 14, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 12,
          padding: 20,
          width: "100%",
          maxWidth: 380,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <strong style={{ color: "#d9e4f5", fontSize: "1rem", flex: 1 }}>{titulo}</strong>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: "none",
              color: "#7f8db0",
              fontSize: "1.3rem",
              lineHeight: 1,
              cursor: loading ? "default" : "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <input
          ref={emailRef}
          type="email"
          placeholder="tu@email.com"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />
        <input
          type="password"
          placeholder="contraseña (mín. 6)"
          value={pass}
          autoComplete="current-password"
          onChange={(e) => setPass(e.target.value)}
          style={input}
        />

        {mode === "signup" && (
          <input
            ref={nickRef}
            type="text"
            placeholder="nombre de usuario"
            value={nick}
            maxLength={20}
            autoComplete="nickname"
            onChange={(e) => setNick(e.target.value)}
            style={input}
          />
        )}

        {notice && (
          <p role="status" style={{ color: "#ffb86b", fontSize: "0.82rem", margin: "0 0 10px" }}>
            {notice}
          </p>
        )}

        {mode === "signup" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { setMode("login"); setNotice(""); }}
              disabled={loading}
              style={{
                flex: 1, padding: 10, borderRadius: 8, border: "1px solid #223051",
                background: "transparent", color: "#7f8db0", fontWeight: 700, cursor: "pointer",
              }}
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void submit("signup")}
              disabled={loading}
              style={{
                flex: 1, padding: 10, borderRadius: 8, border: "none",
                background: "#00e5ff", color: "#0e1320", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Un momento…" : "Crear cuenta"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void submit("login")}
              disabled={loading}
              style={{
                flex: 1, padding: 10, borderRadius: 8, border: "none",
                background: "#00e5ff", color: "#0e1320", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Un momento…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setNotice(""); }}
              disabled={loading}
              style={{
                flex: 1, padding: 10, borderRadius: 8, border: "1px solid #00e5ff",
                background: "transparent", color: "#00e5ff", fontWeight: 700, cursor: "pointer",
              }}
            >
              Crear cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
