"""Normalización de titulares para comparar noticias entre portales."""

from __future__ import annotations

import re
import unicodedata

# Palabras vacías del español (solo función: dejan pasar el contenido real)
STOPWORDS = {
    "a", "al", "ante", "bajo", "cabe", "con", "contra", "de", "del", "desde",
    "durante", "e", "el", "en", "entre", "era", "es", "ese", "esa", "eso",
    "esta", "este", "esto", "estos", "estas", "fue", "ha", "han", "habia",
    "hacia", "hasta", "la", "las", "le", "los", "lo", "mas", "menos", "ni",
    "o", "para", "pero", "por", "porque", "que", "se", "ser", "si", "sin",
    "sobre", "son", "su", "sus", "tras", "un", "una", "unas", "unos", "y", "ya",
}


def normalize_title(title: str) -> str:
    """Deja el titular en minúsculas, sin acentos, sin puntuación y sin vacías."""
    text = (title or "").lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [w for w in text.split() if w not in STOPWORDS and len(w) > 1]
    return " ".join(tokens)