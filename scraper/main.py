"""Orquestador: junta todo y escribe data/news.json con el ranking."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from .cluster import cluster
from .fetch import fetch_all
from .rank import rank

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "data" / "news.json"


def run() -> dict:
    now = dt.datetime.now(dt.timezone.utc)

    articles, errors = fetch_all()
    for article in articles:
        article["first_seen"] = now.isoformat()

    stories = cluster(articles)
    top = rank(stories, now=now)

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