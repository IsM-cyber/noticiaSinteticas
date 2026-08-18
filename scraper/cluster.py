"""Agrupa artículos de distintos portales que cuentan la misma noticia."""

from __future__ import annotations

import datetime as dt
import re

from .config import CLUSTER_WINDOW_HOURS, JACCARD_THRESHOLD
from .normalize import normalize_title

# "Martes 18 de agosto de 2026" → columnas de efemérides, no son noticia.
# El título llega NORMALIZADO (sin "de", sin acentos): "martes 18 agosto 2026"
EFEMERIDES_RE = re.compile(
    r"^(lunes|martes|miercoles|jueves|viernes|sabado|domingo) \d{1,2} "
    r"(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|"
    r"noviembre|diciembre) \d{4}$"
)


def _is_efemerides(title: str) -> bool:
    return bool(EFEMERIDES_RE.fullmatch(normalize_title(title)))


def _parse_dt(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _tokenize(normalized: str) -> set[str]:
    return set(normalized.split())


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def cluster(articles: list[dict]) -> list[dict]:
    """Devuelve stories: {"key": título normalizado, "articles": [artículo, ...]}.

    Pase 0: filtrar columnas de efemérides (fechas históricas) que no son noticia.
    Pase 1: titulares normalizados idénticos -> misma noticia, sin importar la hora.
    Pase 2: los que quedaron solos se fusionan por similitud de tokens (Jaccard)
            sólo si caen dentro de la ventana de tiempo.
    """
    # eliminar efemérides tipo "Martes 18 de agosto de 2026" (columnas históricas)
    articles = [a for a in articles if not _is_efemerides(a["title"])]

    # eliminar duplicados del MISMO portal (mismo artículo repetido en la portada)
    seen_articles: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for article in articles:
        key_art = (article.get("portal"), article.get("url"))
        if key_art in seen_articles:
            continue
        seen_articles.add(key_art)
        deduped.append(article)
    articles = deduped

    stories: list[dict] = []
    by_key: dict[str, dict] = {}

    for article in articles:
        key = normalize_title(article["title"])
        if not key:
            continue
        if key in by_key:
            by_key[key]["articles"].append(article)
        else:
            story = {"key": key, "articles": [article]}
            by_key[key] = story
            stories.append(story)

    singles = [s for s in stories if len(s["articles"]) == 1]
    merged_ids: set[int] = set()

    for i, s1 in enumerate(singles):
        if id(s1) in merged_ids:
            continue
        d1 = _parse_dt(s1["articles"][0].get("published_at"))
        for s2 in singles[i + 1:]:
            if id(s2) in merged_ids:
                continue
            d2 = _parse_dt(s2["articles"][0].get("published_at"))
            if d1 and d2 and abs(d1 - d2) > dt.timedelta(hours=CLUSTER_WINDOW_HOURS):
                continue
            if _jaccard(_tokenize(s1["key"]), _tokenize(s2["key"])) >= JACCARD_THRESHOLD:
                s1["articles"].extend(s2["articles"])
                merged_ids.add(id(s2))

    return [s for s in stories if id(s) not in merged_ids]