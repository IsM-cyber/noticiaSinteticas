"""Trae las noticias de cada fuente y las devuelve como artículos planos.

Un artículo es un dict:
{
    "portal": str,        # nombre de la fuente
    "title": str,         # titular
    "url": str,           # link al artículo original
    "published_at": str|None,  # ISO-8601 UTC de publicación (None si la fuente no lo da)
    "category": str|None, # sección/categoría si la fuente la provee
}
"""

from __future__ import annotations

import datetime as dt
import re
import time

import feedparser
import requests
from bs4 import BeautifulSoup

from .config import SOURCES, USER_AGENT

HEADERS = {"User-Agent": USER_AGENT}

MAX_ITEMS_PER_SOURCE = 40
RETRY_ATTEMPTS = 2
RETRY_BACKOFF_S = 2.0
POLITE_SLEEP_S = 0.4

JINA_PREFIX = "https://r.jina.ai/"   # lector gratuito que trae páginas por su propia IP
JINA_RETRY_SLEEP = 45.0              # r.jina.ai limita por frecuencia → esperar y reintentar
JINA_BODY_BUDGET = 8                 # máximo de cuerpos vía JINA por corrida (servicio gratis)
JINA_POLITE_SLEEP = 4.0

_jina_budget_used = 0


def _jina(url: str) -> str:
    """Trae una página vía r.jina.ai (texto/markdown). Reintenta si el
    servicio devuelve 403 (límite de frecuencia)."""
    for attempt in range(2):
        resp = requests.get(JINA_PREFIX + url, headers=HEADERS, timeout=40)
        if resp.status_code == 200:
            return resp.text
        if attempt == 0 and resp.status_code in (403, 429, 500, 502, 503):
            time.sleep(JINA_RETRY_SLEEP)
            continue
        resp.raise_for_status()
    raise RuntimeError("jina: sin respuestas útiles")


def _jina_body(text: str) -> str | None:
    """Saca el contenido útil del markdown de JINA."""
    marker = "Markdown Content:"
    idx = text.find(marker)
    body = text[idx + len(marker):] if idx != -1 else text
    body = re.sub(r"\s+", " ", body).strip()
    return body if len(body) >= 100 else None


def _jina_listing(source: dict, url: str) -> list[dict]:
    """Extrae (título, link) de las notas desde el markdown de JINA."""
    text = _jina(url)
    hint = source.get("link_hint", "/nota/")
    out: list[dict] = []
    for m in re.finditer(r"\[([^\]]{10,200})\]\((https?://[^)]+)\)", text):
        title = _clean(m.group(1))
        link = m.group(2)
        if not title or hint not in link:
            continue
        out.append({
            "portal": source["name"],
            "title": title,
            "url": link,
            "published_at": None,
            "category": None,
            "body": None,
            "image": None,
        })
        if len(out) >= MAX_ITEMS_PER_SOURCE:
            break
    return out


def _get(url: str) -> requests.Response:
    """GET con reintento automático ante bloqueos (403/429/5xx)."""
    for attempt in range(RETRY_ATTEMPTS):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=25)
            if resp.status_code in (403, 429) or resp.status_code >= 500:
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            return resp
        except Exception:
            if attempt == RETRY_ATTEMPTS - 1:
                raise
            time.sleep(RETRY_BACKOFF_S)
    raise RuntimeError("sin reintentos disponibles")  # no debería pasar

RSC_CHUNK_RE = re.compile(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', re.S)
RSC_ITEM_RE = re.compile(
    r'\{"id":\d+,"titulo":"((?:[^"\\]|\\.)*)","slug":"((?:[^"\\]|\\.)*)"'
    r',"copete":"((?:[^"\\]|\\.)*)","imagen_url":"((?:[^"\\]|\\.)*)","video_url":(?:[^,]*),'
    r'"es_video":\d+,"es_destacada":\d+,"fecha_publicacion":"([\dT:.Z-]+)",'
    r'"seccion_nombre":"((?:[^"\\]|\\.)*)"',
    re.S,
)


def _iso(dt_obj: dt.datetime | None) -> str | None:
    if dt_obj is None:
        return None
    return dt_obj.astimezone(dt.timezone.utc).isoformat()


def fetch_source(source: dict) -> list[dict]:
    """Devuelve los artículos de una fuente. Nunca lanza: envuelve el error."""
    kind = source["type"]
    try:
        if kind == "rss":
            return _fetch_rss(source)
        if kind == "html":
            return _fetch_html(source)
        if kind == "rsc":
            return _fetch_rsc(source)
        raise ValueError(f"tipo de fuente desconocido: {kind!r}")
    except Exception as exc:
        # el llamador (main.py) decide si loguear o fallar
        raise RuntimeError(f"{source['name']}: {exc}") from exc


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace('\\"', '"')).strip()


def _fetch_rss(source: dict) -> list[dict]:
    feed = feedparser.parse(source["url"], agent=USER_AGENT)
    out = []
    for entry in feed.entries[:MAX_ITEMS_PER_SOURCE]:
        title = _clean(entry.get("title"))
        link = (entry.get("link") or "").strip()
        if not title or not link:
            continue
        t = entry.get("published_parsed") or entry.get("updated_parsed")
        published = _iso(dt.datetime(*t[:6], tzinfo=dt.timezone.utc)) if t else None
        category = None
        if entry.get("tags") and entry["tags"][0].get("term"):
            category = entry["tags"][0]["term"]
        out.append({
            "portal": source["name"],
            "title": title,
            "url": link,
            "published_at": published,
            "category": category,
            "body": _body_from_feed(entry),
            "image": _image_from_entry(entry),
        })
    return out


def _image_from_entry(entry) -> str | None:
    """Imagen de la nota desde el propio feed (media_content > enclosure > <img>)."""
    for media in entry.get("media_content") or []:
        url = media.get("url")
        if url and (media.get("medium") or media.get("type") or "").startswith("image"):
            return url
    for enc in entry.get("enclosures") or []:
        if (enc.get("type") or "").startswith("image") and enc.get("href"):
            return enc["href"]
    content = ""
    if entry.get("content") and entry["content"][0].get("value"):
        content = entry["content"][0]["value"]
    elif entry.get("summary"):
        content = entry["summary"]
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content)
    return match.group(1) if match else None


def _body_from_feed(entry) -> str | None:
    """Texto de la nota desde el propio feed (content > summary > description)."""
    if entry.get("content") and entry["content"][0].get("value"):
        return entry["content"][0]["value"]
    if entry.get("summary"):
        return entry["summary"]
    if entry.get("description"):
        return entry["description"]
    return None


def _fetch_html(source: dict) -> list[dict]:
    try:
        resp = _get(source["url"])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception:
        if source.get("jina_fallback"):
            items = _jina_listing(source, source["url"])
            if items:
                print(f"  [jina] {source['name']}: {len(items)} artículos vía r.jina.ai")
                return items
        raise
    out = []
    for article_el in soup.select(source["article_selector"])[:MAX_ITEMS_PER_SOURCE]:
        title_el = article_el.select_one(source["title_selector"])
        if title_el is None:
            continue
        title = _clean(title_el.get_text(" ", strip=True))
        if not title:
            continue
        anchor = title_el if title_el.name == "a" else title_el.find("a")
        href = anchor.get("href") if anchor else None
        if not href and source.get("link_selector"):
            link_el = article_el.select_one(source["link_selector"])
            href = link_el.get("href") if link_el else None
        if not href:
            continue
        url = requests.compat.urljoin(source.get("url_base", source["url"]), href)
        out.append({
            "portal": source["name"],
            "title": title,
            "url": url,
            "published_at": None,
            "category": None,
        })
    return out


def _decode_rsc(html_text: str) -> str:
    """Une los chunks de React Server Components y corrige el doble escape."""
    chunks = RSC_CHUNK_RE.findall(html_text)
    if not chunks:
        return ""
    raw = "".join(chunks)
    decoded = raw.encode().decode("unicode_escape", errors="ignore")
    # los acentos llegan como bytes UTF-8 mal interpretados (mojibake latin-1)
    return decoded.encode("latin-1", errors="ignore").decode("utf-8", errors="ignore")


def _fetch_rsc(source: dict) -> list[dict]:
    resp = _get(source["url"])
    resp.raise_for_status()
    decoded = _decode_rsc(resp.text)
    out = []
    for m in RSC_ITEM_RE.finditer(decoded):
        title = _clean(m.group(1))
        slug = _clean(m.group(2))
        copete = _clean(m.group(3))
        image = _clean(m.group(4))
        if not title or not slug:
            continue
        try:
            published = _iso(dt.datetime.fromisoformat(m.group(5).replace("Z", "+00:00")))
        except ValueError:
            published = None
        out.append({
            "portal": source["name"],
            "title": title,
            "url": source["article_url_template"].format(slug=slug),
            "published_at": published,
            "category": m.group(6) or None,
            "body": copete or None,
            "image": image or None,
        })
    return out


# selectores genéricos de cuerpo para portales WordPress (feed sin texto)
GENERIC_BODY_SELECTORS = [
    "div.entry-content",
    "div.post-content",
    "div.the-content",
    "article",
]


def fetch_body(source: dict, url: str) -> tuple[str | None, str | None]:
    """Baja el texto y la imagen principal (og:image) de una nota.

    Devuelve (texto, imagen). Usa el selector propio de la fuente si lo tiene;
    si no (o si falla), prueba selectores genéricos de cuerpo (WordPress).
    """
    try:
        resp = _get(url)
    except Exception:
        global _jina_budget_used
        if source.get("jina_fallback") and _jina_budget_used < JINA_BODY_BUDGET:
            time.sleep(JINA_POLITE_SLEEP)
            jina_text = _jina(url)
            jina_body = _jina_body(jina_text)
            _jina_budget_used += 1
            if jina_body:
                print(f"  [body jina] {source['portal']}: bajado")
                return jina_body, None
        raise
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    time.sleep(POLITE_SLEEP_S)  # cortesía: no martillar al portal
    selectors = [source["body_selector"]] if source.get("body_selector") else []
    selectors += GENERIC_BODY_SELECTORS
    text = None
    for selector in selectors:
        element = soup.select_one(selector)
        if element is None:
            continue
        candidate = element.get_text("\n", strip=True)
        if len(candidate) >= 100:  # que sea el cuerpo grande, no un fragmento
            text = candidate
            break
    image = None
    og = soup.find("meta", attrs={"property": "og:image"}) or soup.find(
        "meta", attrs={"name": "og:image"}
    )
    if og and og.get("content"):
        image = og["content"]
    return text, image


def fetch_all() -> tuple[list[dict], list[str]]:
    """Trae todas las fuentes. Devuelve (artículos, errores)."""
    articles: list[dict] = []
    errors: list[str] = []
    for source in SOURCES:
        try:
            items = fetch_source(source)
            articles.extend(items)
            print(f"[ok]   {source['name']}: {len(items)} artículos")
        except Exception as exc:
            errors.append(str(exc))
            print(f"[fail] {source['name']}: {exc}")
    return articles, errors