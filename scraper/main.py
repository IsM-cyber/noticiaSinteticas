"""Orquestador: junta todo y escribe data/news.json con el ranking."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from .cluster import cluster
from .config import MAX_SUMMARIES, SOURCES
from .continuity import inherit_keys
from .fetch import fetch_all, fetch_body
from .rank import apply_rotation, carry_appearance, mark_published, rank
from .summarize import build_summary

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "data" / "news.json"

SOURCE_BY_NAME = {source["name"]: source for source in SOURCES}


def _attach_summaries(top: list[dict], now: dt.datetime) -> None:
    """Escribe el resumen automático de las primeras noticias (sin IA)
    y la primera imagen disponible de cada noticia."""
    for story in top[:MAX_SUMMARIES]:
        bodies: list[dict] = []
        story_image = None
        for article in story["articles"]:
            source = SOURCE_BY_NAME.get(article["portal"])
            if source is None:
                continue
            text = article.get("body")
            image = article.get("image")
            if not text:
                try:
                    text, fetched_image = fetch_body(source, article["url"])
                    image = image or fetched_image
                    if text:
                        print(f"  [body] {article['portal']}: bajado")
                except Exception as exc:
                    print(f"  [body] {article['portal']}: {exc}")
                    text = None
            if story_image is None:
                story_image = image
            if text and len(str(text).strip()) > 20:
                bodies.append({
                    "portal": article["portal"],
                    "title": article.get("title"),
                    "text": text,
                })
        story["image"] = story_image
        if bodies:
            story["summary"] = build_summary(bodies)
            print(f"  [resumen] {story['title'][:50]}… → {len(story['summary']['paragraphs'])} párrafos")
        else:
            story["summary"] = {"paragraphs": [], "generated": None}


def _load_previous_stories() -> list[dict]:
    """Las noticias de la corrida anterior (para heredar claves/comentarios)."""
    try:
        payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []
    return payload.get("stories", [])


def _first_seen_index(previous_stories: list[dict]) -> dict[str, str]:
    """URL -> cuándo la vimos por primera vez.

    `first_seen` tiene que sobrevivir entre corridas. Si se recalculara en
    cada vuelta, un portal que no informa fecha haría que sus notas nacieran
    nuevas cada 30 minutos y no se caerían nunca del ranking.
    """
    index: dict[str, str] = {}
    for story in previous_stories:
        for article in story.get("articles", []):
            url = article.get("url")
            seen = article.get("first_seen")
            if not url or not seen:
                continue
            if url not in index or seen < index[url]:
                index[url] = seen
    return index


def run() -> dict:
    now = dt.datetime.now(dt.timezone.utc)

    previous = _load_previous_stories()
    seen_before = _first_seen_index(previous)

    articles, errors = fetch_all()
    for article in articles:
        # la primera vez que la vimos, o ahora si es nueva
        article["first_seen"] = seen_before.get(
            article.get("url") or "", now.isoformat()
        )

    stories = cluster(articles)
    top = rank(stories, now=now)
    _attach_summaries(top, now)

    # todas las noticias publicadas tienen que tener resumen:
    # las que no lograron texto se eliminan del ranking
    before = len(top)
    top = [s for s in top if s["summary"]["paragraphs"]]
    if len(top) != before:
        print(f"→ {before - len(top)} noticia(s) sin texto posible: eliminadas del ranking")

    # heredar claves del ranking anterior (los comentarios sobreviven a los cambios de titular)
    top = inherit_keys(top, previous)

    # la rotación va DESPUÉS de heredar claves: si una noticia conserva
    # la clave vieja, tiene que conservar también su cuenta de apariciones
    carry_appearance(top, previous)
    top = apply_rotation(top, now)
    mark_published(top, now)

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