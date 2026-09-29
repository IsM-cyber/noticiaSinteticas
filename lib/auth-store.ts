"use client";

/**
 * Estado de sesion compartido entre el chat y los comentarios.
 *
 * Antes cada componente leia localStorage una sola vez al montarse, asi que
 * loguearse en uno no actualizaba el otro: quedaban como dos sitios separados
 * hasta recargar la pagina. Esto es un store minimo con suscripcion para que
 * un login en cualquier lado se refleje al instante en el otro.
 *
 * Se usa useSyncExternalStore: el valor vive en una variable de modulo y solo
 * se reemplaza cuando cambia de verdad, que es lo que exige React para no
 * entrar en un loop de renders.
 */

export type Session = { email: string; nickname: string };

const TOKEN_KEY = "ns_token";
const NICK_KEY = "ns_nick";

let session: Session | null = null;
let token = "";
const listeners = new Set<() => void>();

/** getSnapshot de useSyncExternalStore: identidad estable mientras no cambie. */
export function getSession(): Session | null {
  return session;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const l of listeners) l();
}

/** Guarda sesion y token, y avisa a todos los suscriptores. */
export function startSession(next: Session, accessToken: string) {
  const same =
    session !== null &&
    next.email === session.email &&
    next.nickname === session.nickname &&
    accessToken === token;
  token = accessToken;
  session = same ? session : next;
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(NICK_KEY, next.nickname);
  } catch {
    /* modo privado / sin localStorage */
  }
  if (!same) emit();
}

/** Cierra sesion en todos los componentes a la vez. */
export function endSession() {
  const had = session !== null;
  session = null;
  token = "";
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NICK_KEY);
  } catch {
    /* sin localStorage */
  }
  if (had) emit();
}

/** Token de acceso para las llamadas autenticadas (Authorization: Bearer). */
export function getToken(): string {
  if (!token) {
    try {
      token = localStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
      token = "";
    }
  }
  return token;
}

/**
 * Valida el token guardado contra el servidor y publica la sesion.
 * Si el token no sirve, cierra la sesion en todos los componentes.
 */
export async function validate(): Promise<boolean> {
  const t = getToken();
  if (!t) {
    endSession();
    return false;
  }
  try {
    const res = await fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      endSession();
      return false;
    }
    const d = await res.json();
    if (!d?.email) {
      endSession();
      return false;
    }
    startSession({ email: d.email, nickname: d.nickname ?? "" }, t);
    return true;
  } catch {
    return false;
  }
}
