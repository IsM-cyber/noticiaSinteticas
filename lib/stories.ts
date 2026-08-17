import fs from "fs";
import path from "path";

export type Article = {
  portal: string;
  title: string;
  url: string;
  published_at: string | null;
  category: string | null;
};

export type Story = {
  title: string;
  score: number;
  sources_count: number;
  first_seen: string;
  articles: Article[];
};

export type NewsData = {
  generated_at: string;
  article_count: number;
  fetch_errors: string[];
  stories: Story[];
};

/** Lee data/news.json (commiteado por el robot). */
export function loadNews(): NewsData {
  const file = path.join(process.cwd(), "data", "news.json");
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as NewsData;
  } catch {
    return {
      generated_at: new Date().toISOString(),
      article_count: 0,
      fetch_errors: ["data/news.json no existe: corré `python -m scraper.main`."],
      stories: [],
    };
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