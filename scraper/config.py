"""Fuentes de noticias de Necochea y Quequén.

Cada fuente tiene:
- type "rss": feed RSS/Atom (se lee con feedparser).
- type "html": página HTML con artículos (se lee con BeautifulSoup + selectores CSS).
- type "rsc": página Next.js; las noticias viajan incrustadas en el payload
  React Server Components (JSON dentro de self.__next_f.push(...)).
- weight: preponderancia del portal (Ecos Diarios es el histórico; los demás,
  presencia digital).

Verificado el 2026-08-17: las 9 fuentes responden.
"""

SOURCES = [
    {
        "name": "Ecos Diarios",
        "type": "rss",
        "url": "https://ecosdiariosapiv3.eleco.com.ar/feed-notes",
        "weight": 1.3,
    },
    {
        "name": "Diario Necochea",
        "type": "html",
        "url": "https://diarionecochea.com",
        "weight": 1.2,
        "article_selector": "article.jeg_post",
        "title_selector": "h3.jeg_post_title a, h2.jeg_post_title a",
    },
    {
        "name": "Necochea Digital",
        "type": "html",
        "url": "https://necocheadigital.com",
        "weight": 1.1,
        "article_selector": "article[class*='noticia-']",
        "title_selector": "h2.ftitulo, h3.ftitulo",
        "link_selector": "a[href*='/nota/']",
        "url_base": "https://necocheadigital.com",
    },
    {
        "name": "TSN Necochea",
        "type": "rss",
        "url": "https://tsnnecochea.com.ar/feed/",
        "weight": 1.2,
    },
    {
        "name": "Necochea Libre",
        "type": "rss",
        "url": "https://necochealibre.com.ar/feed/",
        "weight": 1.0,
    },
    {
        "name": "Noticias de Necochea",
        "type": "rss",
        "url": "https://nden.com.ar/rss",
        "weight": 1.0,
    },
    {
        "name": "Necochea News",
        "type": "rss",
        "url": "https://necocheanews.com.ar/feed/",
        "weight": 1.0,
    },
    {
        "name": "Diario NQ",
        "type": "rss",
        "url": "https://diarionq.com.ar/feed/",
        "weight": 1.0,
    },
    {
        "name": "Informate Necochea",
        "type": "rsc",
        "url": "https://informatenecochea.com",
        "weight": 1.0,
        "article_url_template": "https://informatenecochea.com/noticia/{slug}",
    },
]

# --- Parámetros del ranking (tunear libremente) ---
CLUSTER_WINDOW_HOURS = 36     # ventana para considerar dos artículos "la misma noticia"
JACCARD_THRESHOLD = 0.6       # solapamiento mínimo de tokens para agrupar
FRESHNESS_HALFLIFE_HOURS = 12 # a las 12 h una noticia pierde la mitad del puntaje de frescura
MAX_STORIES = 30              # cuántas noticias salen en el ranking
USER_AGENT = "NoticiasSinteticas/1.0 (agregador local de noticias de Necochea; contacto: propietario del sitio)"