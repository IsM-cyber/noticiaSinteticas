"""Rotación del ranking: lo que ya salió mucho se hunde, y puede volver."""

import datetime as dt

from scraper.continuity import inherit_keys
from scraper.rank import apply_rotation, carry_appearance, mark_published, rank

NOW = dt.datetime(2026, 9, 30, 12, 0, tzinfo=dt.timezone.utc)


def _story(title, portals, hours_ago=1.0, first_seen_hours=None):
    """Story ya clusterizada. `first_seen_hours` aparte del `published_at` para
    poder simular que un portal republicó algo viejo."""
    seen = NOW if first_seen_hours is None else NOW - dt.timedelta(hours=first_seen_hours)
    articles = [
        {
            "portal": portal,
            "title": title,
            "url": f"https://x.com/{title[:3]}-{i}",
            "published_at": (NOW - dt.timedelta(hours=hours_ago)).isoformat(),
            "category": None,
            "first_seen": seen.isoformat(),
        }
        for i, portal in enumerate(portals)
    ]
    return {"key": title, "articles": articles}


# ------------------------------------------------------------------ el reloj


def test_republicar_no_reinicia_el_reloj():
    """Un portal republica una nota vieja con fecha de hoy.

    first_seen sigue diciendo cuándo la vimos por primera vez, así que la nota
    no vuelve a la portada como si fuera nueva.
    """
    nueva_fecha = _story("Repeditada", ["Ecos Diarios"], hours_ago=0.5, first_seen_hours=200)
    # misma URL vista hace 200 h, pero el portal la volvió a publicar ahora
    ranked = rank([nueva_fecha], now=NOW)
    ranking_fresco = _story("De verdad nueva", ["Ecos Diarios"], hours_ago=0.5)
    ranked_fresco = rank([ranking_fresco], now=NOW)

    assert ranked[0]["score"] < ranked_fresco[0]["score"], (
        "la republicada tiene que puntuar menos que la realmente nueva"
    )


def test_archivo_viejo_no_parece_nuevo():
    """Un RSS con notas de hace años: la fecha del portal la delata."""
    archivada = _story("De archivo", ["Ecos Diarios"], hours_ago=8000)
    # first_seen es ahora: la acabamos de bajar del feed
    archivada["articles"][0]["first_seen"] = NOW.isoformat()
    fresca = _story("Recién salida", ["Ecos Diarios"], hours_ago=1)

    ranked = rank([archivada, fresca], now=NOW)
    assert ranked[0]["title"] == "Recién salida"


def test_grupo_usa_el_articulo_mas_viejo():
    """Si una parte del grupo ya estaba, el grupo entero ya estaba."""
    viejo = _story("Historia", ["Ecos Diarios"], hours_ago=100)
    viejo["articles"].append(
        {
            "portal": "TSN Necochea",
            "title": "Historia",
            "url": "https://x.com/tarde",
            "published_at": (NOW - dt.timedelta(hours=2)).isoformat(),
            "category": None,
            "first_seen": NOW.isoformat(),
        }
    )
    sola = _story("Otra", ["TSN Necochea"], hours_ago=2)

    ranked = rank([viejo, sola], now=NOW)
    assert ranked[0]["title"] == "Otra", "el grupo con una parte vieja tiene que perder"


# ----------------------------------------------------------------- la rotación


def _con_score(score, **extra):
    return {"key": "k", "title": "t", "score": score, "articles": [], **extra}


def test_primera_vez_no_pena():
    s = _con_score(10.0, apariciones=0)
    apply_rotation([s], NOW)
    assert s["score"] == 10.0


def test_repetida_se_hunde():
    s = _con_score(10.0, apariciones=4, ultima_impresion=NOW.isoformat())
    apply_rotation([s], NOW)
    assert s["score"] < 10.0


def test_puede_volver():
    """Las tres directivas: se hunde, pero el castigo se olvida solo."""
    s = _con_score(10.0, apariciones=4, ultima_impresion=NOW.isoformat())

    apply_rotation([s], NOW)
    hundida = s["score"]
    assert hundida < 10.0 * 0.6, "recién salida tiene que estar castigada"

    # 4 ciclos (= 2 h a 30 min) después ya se olvidó de las 4 apariciones
    mas_late = NOW + dt.timedelta(minutes=4 * 30)
    s2 = _con_score(10.0, apariciones=4, ultima_impresion=NOW.isoformat())
    apply_rotation([s2], mas_late)
    assert s2["score"] == 10.0, "con el tiempo la noticia vuelve a su puntaje"


def test_la_rotacion_reordena():
    """La que sale mucho se va de arriba, aunque sea la mejor del día."""
    repetida = _con_score(10.0, apariciones=5, ultima_impresion=NOW.isoformat())
    nueva = _con_score(9.9, apariciones=0)
    resultado = apply_rotation([repetida, nueva], NOW)
    assert resultado[0] is nueva


def test_mark_published_suma_uno():
    s = _con_score(10.0, apariciones=2)
    mark_published([s], NOW)
    assert s["apariciones"] == 3
    assert s["ultima_impresion"] == NOW.isoformat()


# ------------------------------------------------------- continuidad de la cuenta


def test_titulo_cambiado_conserva_la_cuenta():
    """Si le cambiamos el titular, no puede volver a la portada como nueva."""
    vieja = {
        "key": "gremio-reclama-a-las-patronales",
        "title": "Gremio reclama a las patronales",
        "apariciones": 6,
        "ultima_impresion": NOW.isoformat(),
    }
    nueva = [{"key": "otro", "title": "Gremio reclamó a las patronales", "articles": []}]
    top = inherit_keys(nueva, [vieja])

    assert top[0]["key"] == vieja["key"], "debe reusar la clave vieja"
    assert top[0]["apariciones"] == 6, "y con ella, la cuenta de veces que salió"


def test_carry_appearance_cruza_claves():
    viejo = {"key": "k1", "apariciones": 3, "ultima_impresion": NOW.isoformat()}
    nuevo = [{"key": "k1", "score": 5.0}, {"key": "k2", "score": 4.0}]
    carry_appearance(nuevo, [viejo])

    assert nuevo[0]["apariciones"] == 3
    assert nuevo[1].get("apariciones") is None, "la que es nueva no hereda nada"