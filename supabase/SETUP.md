# GUÍA — Activar los comentarios (Supabase)

Todo el código ya está listo; falta conectarle la base de datos. Son **~5 minutos**:

## 1) Crear la cuenta y el proyecto
1. Entrá a **https://supabase.com** → **Start your project** → registrate con un email.
2. **New project** → Nombre: `noticiasinteticas` → poné una contraseña de base de datos
   (guardala, aunque no la vamos a usar seguido) → elegí región (South America funciona).
3. Esperá ~1 minuto a que se cree.

## 2) Crear la tabla de comentarios
1. Menú de la izquierda: **SQL Editor** → **New query**.
2. Copiá TODO el contenido del archivo `supabase/schema.sql` y pegálo → **Run**.
3. Tenés que ver algo como "Success. No rows returned".

## 3) Ajustar el login (para que funcione sin confirmar email)
1. Menú izquierdo: **Authentication** → **Providers** → **Email**.
2. Desmarcá **"Confirm email"** (así la primera cuenta entra al toque) → **Save**.

## 4) Copiar las 3 claves
1. Menú izquierdo: **Project Settings** → **API**.
2. Copiá estas 3 cosas:
   - **Project URL** → para `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → para `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secret) → para `SUPABASE_SERVICE_ROLE_KEY` (⚠ no compartirla con nadie)

## 5) Cargar las claves en Vercel
1. En **vercel.com** → tu proyecto → **Settings** → **Environment Variables**.
2. Agregá estas 4:
   - `NEXT_PUBLIC_SUPABASE_URL` ← Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← anon public
   - `SUPABASE_SERVICE_ROLE_KEY` ← service_role
   - `ADMIN_EMAIL` ← tu email (el editor, el que modera)
3. Redeploy: `cd ~/Desktop/noticiaSinteticas && npx vercel --prod` (o botón Redeploy en Vercel).

## 6) Probar
- En el sitio, cada noticia tiene "Comentarios": tocá **Crear cuenta** (primer usuario = vos),
  comentá, y después entrá a **https://noticiasinteticas.vercel.app/admin** con tu email
  para **aprobar** el comentario (los comentarios solo se publican aprobados).
- Los visitantes reportan con el botón ⚑ → te queda marcado como "reported" en el panel.

## Cómo funciona la seguridad (para saberlo)
- Los comentarios se guardan en Supabase con **RLS**: cualquiera lee aprobados, solo
  logueados escriben, y los cambios de estado (aprobar/rechazar) usan la service_role
  key que vive solo en el servidor — nunca llega al navegador.
- El email del autor se muestra enmascarado (pe*****@gmail.com).
- Si algún día querés borrar todo: Supabase → Table Editor → comments → Delete.