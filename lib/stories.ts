import fs from "fs";
import path from "path";

export type Article = {
  portal: string;
  title: string;
  url: string;
  published_at: string | null;
  category: string | null;
};

export type Summary = {
  paragraphs: string[];
  generated: string | null;
};

export type Story = {
  title: string;
  score: number;
  sources_count: number;
  first_seen: string;
  summary?: Summary;
  articles: Article[];
};

export type NewsData = {
  generated_at: string;
  article_count: number;
  fetch_errors: string[];
  stories: Story[];
};

/**
 * El robot commitea data/news.json en GitHub cada 30 minutos.
 * El sitio lo lee DESDE GITHUB en cada visita → siempre fresco, sin redeploy.
 * Si GitHub no responde, usa la copia local (útil en desarrollo).
 */
const DATA_URL =
  "https://raw.githubusercontent.com/IsM-cyber/noticiaSinteticas/main/data/news.json";

export async function loadNews(): Promise<NewsData> {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (res.ok) {
      return (await res.json()) as NewsData;
    }
    throw new Error(`GitHub respondió HTTP ${res.status}`);
  } catch (err) {
    console.warn("loadNews: no se pudo leer de GitHub, usando copia local:", err);
    const file = path.join(process.cwd(), "data", "news.json");
    try {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw) as NewsData;
    } catch {
      return {
        generated_at: new Date().toISOString(),
        article_count: 0,
        fetch_errors: ["No se pudo leer data/news.json."],
        stories: [],
      };
    }
  }
}

/** "hace 3 h", "hace 2 d"… en español. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}