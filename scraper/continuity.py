"""Continuidad de claves entre corridas.

Si una noticia del ranking nuevo es muy parecida a una del ranking anterior,
se le reutiliza la clave vieja: así los comentarios del sitio sobreviven
a los cambios de titular (la misma historia sigue con el mismo hilo).

Mismo criterio que el agrupador: solapamiento de palabras (Jaccard) sobre
titulares normalizados — pero sin ventana de tiempo, porque la noticia
puede reaparecer días después.
"""

from __future__ import annotations

from .config import CONTINUITY_THRESHOLD
from .normalize import normalize_title


def _tokens(normalized: str) -> set[str]:
    return set(normalized.split())


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def _heredar_contadores(previous: dict | None, story: dict) -> None:
    """La noticia nueva toma de la vieja cuántas veces salió y cuándo.

    Sin esto, cambiarle el titular a una noticia reiniciaría su cuenta de
    apariciones y volvería a la portada como si fuera nueva.
    """
    if not previous:
        return
    story["apariciones"] = previous.get("apariciones") or 0
    story["ultima_impresion"] = previous.get("ultima_impresion")


def inherit_keys(new_stories: list[dict], old_stories: list[dict] | None) -> list[dict]:
    """A cada noticia nueva le reutiliza la clave de la noticia vieja más
    parecida, si el solapamiento supera el umbral. Una clave vieja solo
    puede ser reutilizada por UNA noticia nueva (evita choques)."""
    if not old_stories:
        return new_stories

    old = [
        {
            "key": s.get("key", ""),
            "tokens": _tokens(normalize_title(s.get("title") or s.get("key", ""))),
        }
        for s in old_stories
        if s.get("key")
    ]
    if not old:
        return new_stories

    old_raw = {s.get("key"): s for s in old_stories if s.get("key")}
    old_by_key = {o["key"] for o in old}
    used_old_keys: set[str] = set()

    for story in new_stories:
        key = story.get("key", "")
        new_tokens = _tokens(normalize_title(story.get("title") or key))

        if key in old_by_key and key not in used_old_keys:
            used_old_keys.add(key)
            _heredar_contadores(old_raw.get(key), story)
            continue

        best_key, best_score = None, 0.0
        for o in old:
            if o["key"] in used_old_keys:
                continue
            score = _jaccard(new_tokens, o["tokens"])
            if score > best_score:
                best_key, best_score = o["key"], score

        if best_key and best_score >= CONTINUITY_THRESHOLD:
            used_old_keys.add(best_key)
            story["key"] = best_key
            _heredar_contadores(old_raw.get(best_key), story)

    return new_stories