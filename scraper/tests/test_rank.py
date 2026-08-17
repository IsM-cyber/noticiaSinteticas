import datetime as dt

from scraper.rank import rank

NOW = dt.datetime.now(dt.timezone.utc)


def _story(title, portals, hours_ago):
    """Arma una story ya clusterizada."""
    articles = []
    for i, portal in enumerate(portals):
        articles.append({
            "portal": portal,
            "title": title,
            "url": f"https://x.com/{i}",
            "published_at": (NOW - dt.timedelta(hours=hours_ago)).isoformat(),
            "category": None,
            "first_seen": NOW.isoformat(),
        })
    return {"key": title, "articles": articles}


def test_mas_fuentes_gana():
    una = _story("Noticia A", ["TSN Necochea"], 1)
    varias = _story("Noticia B", ["Ecos Diarios", "Diario Necochea", "Necochea Digital"], 1)
    ranked = rank([una, varias], now=NOW)
    assert ranked[0]["title"] == "Noticia B"
    assert ranked[0]["sources_count"] == 3


def test_noticia_vieja_pierde_por_frescura():
    vieja = _story("Noticia C", ["Ecos Diarios", "Diario Necochea", "TSN Necochea"], 48)
    nueva = _story("Noticia D", ["Necochea Digital"], 0.5)
    ranked = rank([vieja, nueva], now=NOW)
    assert ranked[0]["title"] == "Noticia D"


def test_ecos_diarios_pesa_mas_que_un_portal_chico():
    ecos = _story("Noticia E", ["Ecos Diarios"], 1)
    chico = _story("Noticia F", ["Necochea News"], 1)
    ranked = rank([ecos, chico], now=NOW)
    assert ranked[0]["title"] == "Noticia E"


def test_top_n_recorta():
    stories = [_story(f"Noticia {i}", ["TSN Necochea"], 1) for i in range(40)]
    ranked = rank(stories, now=NOW)
    assert len(ranked) <= 30