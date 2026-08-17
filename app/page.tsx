import { loadNews, timeAgo } from "@/lib/stories";

export const dynamic = "force-dynamic";

export default function Home() {
  const data = loadNews();
  const stories = data.stories;

  return (
    <main className="wrap">
      <header className="hero">
        <h1>
          Noticias <span>Sintéticas</span>
        </h1>
        <p>
          Las noticias de Necochea y Quequén con mayor resonancia — la misma
          noticia publicada por varios portales locales, ordenada por relevancia.
        </p>
        <div className="meta">
          <span>Actualizado {timeAgo(data.generated_at)}</span>
          <span aria-hidden>·</span>
          <span>{data.article_count} artículos relevados</span>
          <span aria-hidden>·</span>
          <span>{stories.length} noticias</span>
        </div>
      </header>

      {data.fetch_errors.length > 0 && (
        <aside className="notice">
          ⚠️ {data.fetch_errors.length} fuente(s) fallaron en la última pasada:{" "}
          {data.fetch_errors.join(" · ")}
        </aside>
      )}

      {stories.length === 0 ? (
        <p className="empty">
          Todavía no hay noticias. Corré el robot:{" "}
          <code>.venv/bin/python -m scraper.main</code>
        </p>
      ) : (
        <ol className="list">
          {stories.map((story, i) => (
            <li key={story.first_seen + i}>
              <article className="card">
                <div className="card-head">
                  <span className="rank">#{i + 1}</span>
                  <span className="resonance" title="Puntaje de resonancia">
                    ⟡ {story.sources_count} {story.sources_count === 1 ? "fuente" : "fuentes"}
                  </span>
                  <span className="when">{timeAgo(story.first_seen)}</span>
                </div>
                <h2>{story.title}</h2>
                {story.summary && story.summary.paragraphs.length > 0 && (
                  <div className="summary">
                    <span className="summary-label">Resumen sintético</span>
                    {story.summary.paragraphs.map((paragraph, j) => (
                      <p key={j}>{paragraph}</p>
                    ))}
                  </div>
                )}
                <ul className="sources">
                  {story.articles.map((article, j) => (
                    <li key={article.url + j}>
                      <a href={article.url} target="_blank" rel="noopener noreferrer">
                        Fuente: {article.portal}
                      </a>
                      {article.category && (
                        <span className="category">{article.category}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      )}

      <footer className="foot">
        <a href="/rss.xml">Feed RSS</a>
        <span aria-hidden>·</span>
        <span>Fuentes: Ecos Diarios, Diario Necochea, Necochea Digital, TSN Necochea,
          Necochea Libre, Noticias de Necochea, Necochea News, Diario NQ, Informate Necochea</span>
      </footer>
    </main>
  );
}