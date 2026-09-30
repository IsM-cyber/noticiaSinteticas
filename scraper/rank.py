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
# Una fuente que no da fecha no es "de ahora": se la trata como si estuviera
# en la mitad de su vida útil (0.5), un valor neutro ni bueno ni malo.
UNKNOWN_DATE_FRESHNESS = 0.5
# Tope de noticias por portal en la portada. Sin esto un solo portal con
# muchos artículos y sin fecha tapaba los 30 lugares del ranking.
MAX_STORIES_PER_PORTAL = 6
def _parse_dt(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
def _story_age_hours(story: dict, now: dt.datetime) -> float | None:
    """Cuántas horas lleva esta historia en el sitio.
    De cada artículo toma el dato MÁS TEMPRANO entre cuándo lo vimos por
    primera vez y la fecha que trae el portal, y de todos los artículos del
    grupo el más viejo.

    Los dos datos hacen falta. `first_seen` evita que republicar una nota vieja
    con fecha de hoy le reinicie el reloj. `published_at` evita que un RSS con
    un archivo de notas de hace tres años nos las traiga como si fueran nuevas.
    Se queda con el MÁS ANTIGUO de los artículos del grupo: si una parte de la
    historia ya estaba acá, la historia entera ya estaba acá.
    Si NINGÚN artículo trae fecha devuelve None: no sabemos cuándo es, y el
    llamador le aplica UNKNOWN_DATE_FRESHNESS en vez de frescura 1.0.
    """
    ages = []
    for article in story["articles"]:
        stamps = [
            stamp
            for stamp in (
                _parse_dt(article.get("first_seen")),
                _parse_dt(article.get("published_at")),
            )
            if stamp
        ]
        if stamps:
            ages.append(max(0.0, (now - min(stamps)).total_seconds() / 3600))
    return max(ages) if ages else None
def _cap_per_portal(ranked: list[dict]) -> list[dict]:
    """Deja pasar como mucho MAX_STORIES_PER_PORTAL noticias de cada portal.
    Cada noticia se cuenta para el portal que aporta su titular. Al terminar,
    las que quedaron afuera vuelven a entrar en orden de puntaje para no
    perder posiciones por un límite arbitrario.
    """
    kept: list[dict] = []
    extra: list[dict] = []
    count: dict[str, int] = {}
    for story in ranked:
        portal = story["articles"][0]["portal"] if story["articles"] else "?"
        if count.get(portal, 0) < MAX_STORIES_PER_PORTAL:
            count[portal] = count.get(portal, 0) + 1
            kept.append(story)
        else:
            extra.append(story)
    return kept + extra
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
        freshness = UNKNOWN_DATE_FRESHNESS if age_hours is None \
            else math.exp(-age_hours / FRESHNESS_HALFLIFE_HOURS)
        score = weight_sum * (1 + 0.25 * (n_sources - 1)) * freshness
        # el titular de la noticia sale del portal con más preponderancia
        best = max(articles, key=lambda a: WEIGHTS.get(a["portal"], 1.0))
        story_image = next(
            (a.get("image") for a in articles if a.get("image")), None
        )
        ranked.append({
            "key": story["key"],
            "title": best["title"],
            "score": round(score, 3),
            "sources_count": n_sources,
            "first_seen": min(
                (_parse_dt(a.get("published_at")) or _parse_dt(a.get("first_seen"))
                 for a in articles if (_parse_dt(a.get("published_at")) or _parse_dt(a.get("first_seen")))),
                default=now,
            ).isoformat(),
            "image": story_image,
            "articles": [
                {
                    "portal": a["portal"],
                    "title": a.get("title"),
                    "url": a.get("url"),
                    "published_at": a.get("published_at"),
                    "first_seen": a.get("first_seen"),
                    "category": a.get("category"),
                    "image": a.get("image"),
                }
                for a in sorted(articles, key=lambda x: WEIGHTS.get(x["portal"], 1.0), reverse=True)
            ],
        })
    ranked.sort(key=lambda s: s["score"], reverse=True)
    return _cap_per_portal(ranked)[:MAX_STORIES]


# ---------------------------------------------------------------- rotación
# Una noticia que ya salió varias veces seguidas se hunde, para que entre algo
# nuevo. El castigo se olvida solo: cada ciclo que pasa sin salir le devuelve
# un nivel, así la noticia puede volver si vuelve a resonar.

ROTATION_PENALTY = 0.55   # cada nivel de fatiga multiplica el puntaje por esto
CYCLE_MINUTES = 30       # cada cuánto corre el robot


def _fatigue(story: dict, now: dt.datetime, cycle_minutes: int) -> float:
    """Cuántos ciclos lleva esta noticia saliendo sin parar."""
    apariciones = story.get("apariciones") or 0
    if apariciones <= 0:
        return 0.0
    ultima = _parse_dt(story.get("ultima_impresion"))
    if ultima is None:
        return float(apariciones)
    ciclos = max(0.0, (now - ultima).total_seconds() / (cycle_minutes * 60))
    return max(0.0, apariciones - ciclos)


def carry_appearance(new_stories: list[dict], old_stories: list[dict] | None) -> None:
    """Copia de la corrida anterior cuántas veces salió cada noticia."""
    old_by_key = {s.get("key"): s for s in (old_stories or []) if s.get("key")}
    for story in new_stories:
        prev = old_by_key.get(story.get("key"))
        if prev:
            story["apariciones"] = prev.get("apariciones") or 0
            story["ultima_impresion"] = prev.get("ultima_impresion")


def apply_rotation(
    stories: list[dict], now: dt.datetime, cycle_minutes: int = CYCLE_MINUTES
) -> list[dict]:
    """Hunde las noticias repetidas, reordena y reaplica el tope por portal."""
    for story in stories:
        penalty = ROTATION_PENALTY ** _fatigue(story, now, cycle_minutes)
        story["score"] = round(story["score"] * penalty, 3)
        story["penalizacion"] = round(penalty, 3)
    stories.sort(key=lambda s: s["score"], reverse=True)
    capped = _cap_per_portal(stories)
    capped.sort(key=lambda s: s["score"], reverse=True)
    return capped


def mark_published(stories: list[dict], now: dt.datetime) -> None:
    """Deja constancia de que estas noticias salieron en esta corrida."""
    for story in stories:
        story["apariciones"] = (story.get("apariciones") or 0) + 1
        story["ultima_impresion"] = now.isoformat()
