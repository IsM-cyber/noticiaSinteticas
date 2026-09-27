"""Tests de los 3 bugs queLSL broken ranking silenciosamente.

Cada test falla contra el código anterior al arreglo.
"""

import datetime as dt

from scraper.cluster import cluster
from scraper.config import JACCARD_THRESHOLD
from scraper.fetch import _date_from_url
from scraper.rank import rank


def _art(portal, title, published=None, url=None):
    return {
        "portal": portal,
        "title": title,
        "url": url or f"https://{portal}.test/{abs(hash(title))}",
        "published_at": published,
        "category": None,
    }


def _story(*articles):
    """Grupo minimo con la forma que espera rank(): necesita 'key' y 'articles'."""
    return {"key": articles[0]["title"].lower(), "articles": list(articles)}


NOW = dt.datetime(2026, 9, 27, 0, 0, tzinfo=dt.timezone.utc)
HACE_2H = (NOW - dt.timedelta(hours=2)).isoformat()
HACE_30H = (NOW - dt.timedelta(hours=30)).isoformat()


class TestFrescuraSinFecha:
    """Bug 1: una fuente SIN fecha se puntuaba como si fuera recien publicada."""

    def test_sin_fecha_no_gana_a_una_noticia_fresca(self):
        """El bug: sin fecha sacaba frescura 1.0 (la maxima) y tapaba el ranking.

        Lo que importa no es que una sin fecha le gane a una vieja, sino que
        no le gane a una recien publicada: no saber la fecha no es saber que
        es nueva.
        """
        sin_fecha = [_story(_art("A", "Noticia del portal A", published=None))]
        fresca = [_story(_art("B", "Noticia recién publicada", published=HACE_2H))]

        top = rank(sin_fecha + fresca, now=NOW)

        assert top[0]["articles"][0]["portal"] == "B", (
            "una nota sin fecha no puede ganarle a una publicada hace 2 h"
        )
        assert top[0]["score"] > top[1]["score"]

    def test_sin_fecha_no_gana_a_una_antigua(self):
        """Lo unico que no se debe es perder contra una nota de 30 h."""
        sin_fecha = [_story(_art("A", "Noticia del portal A", published=None))]
        vieja = [_story(_art("B", "Noticia de 30 horas", published=HACE_30H))]

        top = rank(sin_fecha + vieja, now=NOW)

        assert top[0]["articles"][0]["portal"] == "A", (
            "sin fechaKnown=0.5 es neutro: gana a lo viejo, pierde a lo nuevo"
        )

    def test_frescura_desconocida_es_neutra(self):
        """Sin fecha -> 0.5, ni maxima (bug) ni cero (injusto)."""
        top = rank([_story(_art("A", "Noticia sin fecha", published=None))], now=NOW)
        # score = peso 1.0 * 1 * frescura -> debe ser 0.5
        assert top[0]["score"] == 0.5

    def test_fecha_en_url_wordpress(self):
        """Diario Necochea no da fecha en el listado, pero la deja en la URL."""
        assert _date_from_url(
            "https://diarionecochea.com/2026/09/26/crisis-turistica"
        ) == "2026-09-26T00:00:00+00:00"

    def test_url_sin_fecha_devuelve_none(self):
        assert _date_from_url("https://necocheadigital.com/nota/119717/x") is None


class TestAgrupamiento:
    """Bug 2: con umbral 0.6 no se agrupaba NADA entre portales distintos."""

    def test_agrupa_titular_reescrito_de_otra_manera(self):
        """La misma noticia redactada distinto tiene Jaccard ~0.5, no 0.6."""
        titulo_a = "Simulacro de rescate y salvamento marítimo en Puerto Quequén"
        titulo_b = "Prefectura realiza un simulacro de rescate en Quequén"
        assert JACCARD_THRESHOLD <= 0.45, (
            f"el umbral {JACCARD_THRESHOLD} es demasiado alto para titulares de verdad"
        )
        grupos = cluster([_art("A", titulo_a), _art("B", titulo_b)])
        assert len(grupos) == 1, "titulares equivalentes tienen que quedar en un grupo"
        assert len({a["portal"] for a in grupos[0]["articles"]}) == 2

    def test_no_agrupa_noticias_distintas(self):
        """Bajar el umbral no debe meter en el mismo grupo cosas distintas."""
        grupos = cluster([
            _art("A", "Milei criticize a la ONU y reclamo al Reino Unido"),
            _art("B", "Detenidos a cuatro marplatenses por caza furtiva"),
        ])
        assert len(grupos) == 2


class TestCuotaPorPortal:
    """Bug 3: un solo portal con 40 articles tapaba los 30 lugares."""

    def test_un_portal_no_tapa_la_portada(self):
        historias = []
        for i in range(25):
            historias.append(_story(
                _art("Grande", f"Noticia unica del portal grande numero {i}", HACE_2H)
            ))
        historias.append(_story(
            _art("Chico", "Noticia de un portal chico y fresco", HACE_2H)
        ))
        top = rank(historias, now=NOW)
        del top[:6]  # las primeras 6 no pueden ser todas del portal grande
        assert any(s["articles"][0]["portal"] == "Chico" for s in top), (
            "un portal con 25 articulos no puede llenar la portada entera"
        )
