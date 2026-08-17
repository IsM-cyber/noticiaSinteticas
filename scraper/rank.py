"""Puntaje de resonancia: cuántos portales cubren la noticia y qué tan fresca es.

score = suma(ponderación del portal) * (1 + 0.25 * (fuentes - 1)) * frescura

- Más portales cubriendo la misma noticia => más resonancia (peso principal).
- Los portales con más preponderancia pesan más (Ecos Diarios > resto).
- frescura = exp(-edad_horas / 12): a las 12 h la noticia pierde la mitad.
"""

from __future__ import annotations

import datetime as dt
import math

from .config import FRESHNESS_HALFLIFE_HOURS, MAX_STORIES, SOURCES

WEIGHTS = {source["name"]: source.get("weight", 1.0) for source in SOURCES}


def _parse_dt(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _story_age_hours(story: dict, now: dt.datetime) -> float:
    """Edad = mínimo entre fecha publicada y primera vez que la vimos."""
    ages = []
    for article in story["articles"]:
        published = _parse_dt(article.get("published_at"))
        first_seen = _parse_dt(article.get("first_seen"))
        stamp = published or first_seen
        if stamp:
            ages.append(max(0.0, (now - stamp).total_seconds() / 3600))
    return min(ages) if ages else 0.0


def rank(stories: list[dict], now: dt.datetime | None = None) -> list[dict]:
    now = now or dt.datetime.now(dt.timezone.utc)
    ranked: list[dict] = []

    for story in stories:
        articles = story["articles"]
        # fuentes distintas que cubren la noticia + suma de ponderaciones
        seen: set[str] = set()
        weight_sum = 0.0
        for article in articles:
            portal = article["portal"]
            if portal in seen:
                continue
            seen.add(portal)
            weight_sum += WEIGHTS.get(portal, 1.0)
        n_sources = len(seen)
        age_hours = _story_age_hours(story, now)
        freshness = math.exp(-age_hours / FRESHNESS_HALFLIFE_HOURS)
        score = weight_sum * (1 + 0.25 * (n_sources - 1)) * freshness

        # el titular de la noticia sale del portal con más preponderancia
        best = max(articles, key=lambda a: WEIGHTS.get(a["portal"], 1.0))
        ranked.append({
            "title": best["title"],
            "score": round(score, 3),
            "sources_count": n_sources,
            "first_seen": min(
                (_parse_dt(a.get("published_at")) or _parse_dt(a.get("first_seen"))
                 for a in articles if (_parse_dt(a.get("published_at")) or _parse_dt(a.get("first_seen")))),
                default=now,
            ).isoformat(),
            "articles": [
                {
                    "portal": a["portal"],
                    "title": a.get("title"),
                    "url": a.get("url"),
                    "published_at": a.get("published_at"),
                    "category": a.get("category"),
                }
                for a in sorted(articles, key=lambda x: WEIGHTS.get(x["portal"], 1.0), reverse=True)
            ],
        })

    ranked.sort(key=lambda s: s["score"], reverse=True)
    return ranked[:MAX_STORIES]