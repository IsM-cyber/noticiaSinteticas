import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noticias Sintéticas",
  description:
    "Las noticias de Necochea y Quequén con mayor resonancia: la misma noticia publicada por varios portales locales, ordenada por relevancia.",
  metadataBase: new URL("https://noticias-sinteticas.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}