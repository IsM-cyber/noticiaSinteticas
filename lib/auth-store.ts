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
         *
         * Todas las llamadas comparten la misma peticion: la pagina monta 29 cajas
         * de comentarios mas el chat, y cada una validaba por su cuenta. Eso son 30
         * peticiones identicas en paralelo al cargar, todas escribiendo sobre el
         * mismo estado. Con una sola vez alcanza y sobra.
         */
        let enCurso: Promise<boolean> | null = null;

    export function validate(): Promise<boolean> {
      if (enCurso) return enCurso;
      enCurso = validar().finally(() => {
        enCurso = null;
      });
      return enCurso;
    }

    async function validar(): Promise<boolean> {
      // Se lee siempre de localStorage y no de la variable de modulo: si otra
      // pestana acaba de escribir un token distinto, aca todavia puede seguir
      // el viejo y la validacion daria un falso negativo.
      let t = "";
      try {
        t = localStorage.getItem(TOKEN_KEY) ?? "";
      } catch {
        t = "";
      }
          // OJO: aca NO se escribe la variable de modulo "token". Esta validacion
          // tarda, y para cuando responde la sesion ya puede haber cambiado: alguien
          // salio y entro con otro usuario. Escribirla aca volvia a colar el token
          // viejo, y la pantalla decia una cosa mientras las peticiones de los
          // comentarios iban con la otra. El token se escribe recien en startSession,
          // que ya checkea que el token guardado siga siendo el mismo.
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
        // Si mientras esperabamos la respuesta se cerro sesion, o se escribio
        // otro token (otra pestana, o el propio "salir"), este validate ya
        // esta vencido: publicar aca te volvia a loguear sin querer.
        let actual = "";
        try {
          actual = localStorage.getItem(TOKEN_KEY) ?? "";
        } catch {
          actual = "";
        }
        if (actual !== t) return false;
        startSession({ email: d.email, nickname: d.nickname ?? "" }, t);
        return true;
      } catch {
        return false;
      }
    }
