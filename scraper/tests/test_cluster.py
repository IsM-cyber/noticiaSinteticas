import datetime as dt

from scraper.cluster import cluster

NOW = dt.datetime.now(dt.timezone.utc)


def _art(portal, title, hours_ago=None):
    art = {
        "portal": portal,
        "title": title,
        "url": f"https://{portal}.example.com/x",
        "published_at": (NOW - dt.timedelta(hours=hours_ago)).isoformat() if hours_ago is not None else None,
        "category": None,
    }
    return art


def test_mismo_titulo_misma_noticia():
    arts = [
        _art("TSN Necochea", "Choque en la avenida 58 dejó dos heridos", 1),
        _art("Ecos Diarios", "Choque en la avenida 58 dejó dos heridos", 2),
    ]
    stories = cluster(arts)
    assert len(stories) == 1
    assert len(stories[0]["articles"]) == 2


def test_titulos_distintos_noticias_distintas():
    arts = [
        _art("TSN Necochea", "Choque en la avenida 58 dejó dos heridos", 1),
        _art("Ecos Diarios", "La feria de ciencias presentó 104 proyectos", 1),
    ]
    stories = cluster(arts)
    assert len(stories) == 2


def test_similitud_alta_dentro_de_la_ventana_se_fusiona():
    arts = [
        _art("TSN Necochea", "Aprea minimizó su consumo de alcohol antes de atropellar", 2),
        _art("Ecos Diarios", "Aprea minimizó su consumo de alcohol antes de atropellar y matar a Germán Appella", 3),
    ]
    stories = cluster(arts)
    assert len(stories) == 1


def test_similitud_alta_fuera_de_la_ventana_no_se_fusiona():
    arts = [
        _art("TSN Necochea", "Aprea minimizó su consumo de alcohol antes de atropellar", 2),
        _art("Ecos Diarios", "Aprea minimizó su consumo de alcohol antes de atropellar y matar a Germán Appella", 40),
    ]
    stories = cluster(arts)
    assert len(stories) == 2


def test_sin_fecha_no_rompe_la_agrupacion():
    arts = [
        _art("Diario Necochea", "Obra en el puerto de Quequén", None),
        _art("Necochea Digital", "Obra en el puerto de Quequén", None),
    ]
    stories = cluster(arts)
    assert len(stories) == 1


def test_efemerides_no_son_noticias():
    arts = [
        _art("Ecos Diarios", "Martes 18 de agosto de 2026", 1),
        _art("Ecos Diarios", "Domingo 18 de agosto de 1996", 2),
        _art("TSN Necochea", "Una cola de dos cuadras por un empleo en Necochea", 1),
    ]
    stories = cluster(arts)
    assert len(stories) == 1
    assert "cola dos cuadras" in stories[0]["key"]