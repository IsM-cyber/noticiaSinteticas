"""Orquestador: junta todo y escribe data/news.json con el ranking."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from .cluster import cluster
from .config import MAX_SUMMARIES, SOURCES
from .fetch import fetch_all, fetch_body
from .rank import rank
from .summarize import build_summary

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "data" / "news.json"

SOURCE_BY_NAME = {source["name"]: source for source in SOURCES}


def _attach_summaries(top: list[dict], now: dt.datetime) -> None:
    """Escribe el resumen automático de las primeras noticias (sin IA)."""
    for story in top[:MAX_SUMMARIES]:
        bodies: list[dict] = []
        for article in story["articles"]:
            source = SOURCE_BY_NAME.get(article["portal"])
            if source is None:
                continue
            text = article.get("body")
            if not text and source["type"] == "html":
                try:
                    text = fetch_body(source, article["url"])
                    print(f"  [body] {article['portal']}: bajado")
                except Exception as exc:
                    print(f"  [body] {article['portal']}: {exc}")
                    text = None
            if text and len(str(text).strip()) > 20:
                bodies.append({
                    "portal": article["portal"],
                    "title": article.get("title"),
                    "text": text,
                })
        if bodies:
            story["summary"] = build_summary(bodies)
            print(f"  [resumen] {story['title'][:50]}… → {len(story['summary']['paragraphs'])} párrafos")
        else:
            story["summary"] = {"paragraphs": [], "generated": None}


def run() -> dict:
    now = dt.datetime.now(dt.timezone.utc)

    articles, errors = fetch_all()
    for article in articles:
        article["first_seen"] = now.isoformat()

    stories = cluster(articles)
    top = rank(stories, now=now)
    _attach_summaries(top, now)

    payload = {
        "generated_at": now.isoformat(),
        "article_count": len(articles),
        "fetch_errors": errors,
        "stories": top,
    }
    return payload


def main() -> int:
    payload = run()
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"→ {len(payload['stories'])} noticias en {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())