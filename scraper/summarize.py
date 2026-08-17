"""Resumen automático SIN inteligencia artificial.

Juega limpio: toma el texto de las fuentes, lo limpia, elimina oraciones
repetidas entre portales y arma una nota breve de 2 párrafos con los datos
de cada fuente. Las oraciones de los portales con más preponderancia van
primero. Siempre se citan las fuentes en la página.
"""

from __future__ import annotations

import datetime as dt
import html as html_mod
import re
import unicodedata

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

MAX_SENTENCES = 7
MAX_CHARS = 950
DUP_JACCARD = 0.65          # si una oración se parece tanto a otra, es la misma
MIN_SENTENCE_LEN = 25       # ignorar fragmentos tipo "Volver a la portada"


def _strip_html(raw: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_mod.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def split_sentences(raw_text: str) -> list[str]:
    """Divide el texto en oraciones de tamaño útil, limpias de HTML."""
    text = _strip_html(raw_text)
    sentences = []
    for part in _SENTENCE_SPLIT_RE.split(text):
        part = part.strip()
        if len(part) >= MIN_SENTENCE_LEN:
            sentences.append(part)
    return sentences


def _normalize(sentence: str) -> str:
    text = sentence.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", text)


def _tokens(sentence: str) -> set[str]:
    return set(_normalize(sentence).split())


def _is_duplicate(sentence: str, kept: list[str]) -> bool:
    tokens = _tokens(sentence)
    if not tokens:
        return True
    for other in kept:
        other_tokens = _tokens(other)
        union = tokens | other_tokens
        if union and len(tokens & other_tokens) / len(union) >= DUP_JACCARD:
            return True
    return False


def build_summary(bodies: list[dict], max_chars: int = MAX_CHARS,
                  max_sentences: int = MAX_SENTENCES) -> dict:
    """bodies: [{portal, title, text}] ya ordenados por preponderancia.

    Devuelve {"paragraphs": [str, ...], "generated": iso} (vacío si no hay).
    """
    if not bodies:
        return {"paragraphs": [], "generated": None}

    kept: list[str] = []
    for body in bodies:
        text = body.get("text") or ""
        if len(str(text).strip()) < MIN_SENTENCE_LEN:
            continue
        for sentence in split_sentences(text):
            if _is_duplicate(sentence, kept):
                continue
            kept.append(sentence)
            if len(kept) >= max_sentences:
                break

    kept = kept[:max_sentences]
    final: list[str] = []
    total = 0
    for sentence in kept:
        if total + len(sentence) > max_chars:
            break
        final.append(sentence)
        total += len(sentence)

    if not final:
        return {"paragraphs": [], "generated": None}

    half = max(1, (len(final) + 1) // 2)
    paragraphs = [" ".join(final[:half]), " ".join(final[half:])]
    if len(paragraphs) > 1 and not paragraphs[-1]:
        paragraphs.pop()
    return {
        "paragraphs": paragraphs,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(),
    }