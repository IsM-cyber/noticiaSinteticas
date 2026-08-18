import { loadNews } from "@/lib/stories";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const FX = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function GET() {
  const data = loadNews();
  const items = data.stories.slice(0, 20)
    .map(
      (story) => `    <item>
      <title>${FX(story.title)}</title>
      <link>${FX(story.articles[0]?.url ?? "")}</link>
      <guid isPermaLink="false">ns-${FX(story.first_seen)}</guid>
      <pubDate>${new Date(story.first_seen).toUTCString()}</pubDate>
      <description>${FX(
        story.articles.map((a) => `${a.title} — ${a.portal}`).join(" · ")
      )}</description>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME} — Necochea</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>es-ar</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}