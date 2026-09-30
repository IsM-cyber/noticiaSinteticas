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


def _article_tokens(article: dict) -> set[str]:
    return _tokenize(normalize_title(article.get("title") or ""))


def _latest_dt(story: dict) -> dt.datetime | None:
    """La publicación más reciente del grupo (la que define cuándo es la noticia)."""
    stamps = [d for d in (_parse_dt(a.get("published_at")) for a in story["articles"]) if d]
    return max(stamps) if stamps else None


def _same_story(s1: dict, s2: dict, threshold: float) -> bool:
    """¿Algún titular de un grupo se parece a algún titular del otro?

    Se comparan los titulares reales y no la clave del grupo: la clave es el
    título del artículo que entró primero, así que compararla daba resultados
    distintos según el orden en que llegaron los feeds.
    """
    toks1 = [_article_tokens(a) for a in s1["articles"]]
    toks2 = [_article_tokens(a) for a in s2["articles"]]
    return any(_jaccard(t1, t2) >= threshold for t1 in toks1 for t2 in toks2)


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

    # Se comparan TODOS los grupos, no solo los que tienen un artículo. Antes un
    # grupo que ya tenía dos artículos quedaba fuera de la lista y nunca podía
    # fusionarse: la misma noticia aparecía partida en dos filas de la portada.
    merged_ids: set[int] = set()

    for i, s1 in enumerate(stories):
        if id(s1) in merged_ids:
            continue
        d1 = _latest_dt(s1)
        for s2 in stories[i + 1:]:
            if id(s2) in merged_ids:
                continue
            d2 = _latest_dt(s2)
            if d1 and d2 and abs(d1 - d2) > dt.timedelta(hours=CLUSTER_WINDOW_HOURS):
                continue
            if _same_story(s1, s2, JACCARD_THRESHOLD):
                s1["articles"].extend(s2["articles"])
                merged_ids.add(id(s2))
                d1 = _latest_dt(s1)

    return [s for s in stories if id(s) not in merged_ids]