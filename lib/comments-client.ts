// Utilidades compartidas entre cliente y servidor.
// IMPORTANTE: este módulo NO crea clientes de Supabase a propósito.
// El navegador nunca habla directo con Supabase (la red local no resuelve
// el dominio), todo pasa por las rutas /api/* del servidor.

export type CommentRow = {
  id: number;
  story_key: string;
  user_id: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "reported";
  created_at: string;
};

/** "jose*****@gmail.com" — mostrar el autor sin regalar el email completo */
export function maskAuthor(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}*****@${domain}`;
}
