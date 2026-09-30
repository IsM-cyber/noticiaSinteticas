import datetime as dt

from scraper.cluster import cluster

NOW = dt.datetime.now(dt.timezone.utc)


def _art(portal, title, hours_ago=None):
    art = {
        "portal": portal,
        "title": title,
        "url": f"https://{portal}.example.com/{abs(hash((portal, title))) % 10 ** 8}",
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


def test_grupos_con_dos_arts_se_fusionan_igual():
    """El bug que partía la noticia de Povilaitis en dos filas.

    Antes solo se comparaban los grupos que tenían UN artículo. Dos grupos que ya
    habían juntado dos cada uno nunca se veían, y la misma noticia salía partida
    en la portada, con Necochea Digital pesando dos veces.
    """
    arts = [
        _art("TSN Necochea", "Ernesto Povilaitis fue designado nuevo presidente del Consorcio de Gestión de Puerto Quequén", 0.2),
        _art("Necochea Digital", "Bianco confirmó que Ernesto Povilaitis será el presidente del Consorcio de Gestión de Puerto Quequén", 0.1),
        _art("Ecos Diarios", "Ernesto Povilaitis Giovazzino fue designado presidente del Consorcio de Gestión de Puerto Quequén", 0.8),
        _art("Noticias de Necochea", "Puerto Quequén: K|lonlyrichnik oficializó a Ernesto Povilaitis como presidente", 0.3),
    ]
    stories = cluster(arts)
    assert len(stories) == 1, f"debía quedar una sola historia, quedaron {len(stories)}"
    portales = {a["portal"] for a in stories[0]["articles"]}
    assert portales == {
        "TSN Necochea", "Necochea Digital", "Ecos Diarios", "Noticias de Necochea",
    }


def test_ventana_se_mide_por_la_nota_mas_nueva():
    """La ventana no la define el artículo más viejo del grupo.

    Una historia con una nota de ayer y otra de ahora es una noticia de ahora: si
    se mirara el artículo más viejo, se descartaría por ventana y quedaría partida.
    """
    arts = [
        # la nota vieja de Ecos queda arrastrada en el grupo, pero la ventana
        # se mide con la más reciente: si se midiera con la vieja, no fusionaría
        _art("TSN Necochea", "Obra en el puerto de Quequén", 1),
        _art("Ecos Diarios", "Obra en el puerto de Quequén", 41),
        _art("Necochea Digital", "Comienza la obra en el puerto de Quequén", 1),
    ]
    stories = cluster(arts)
    assert len(stories) == 1, f"debía quedar una historia, quedaron {len(stories)}"
