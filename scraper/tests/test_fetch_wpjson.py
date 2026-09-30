"""La fuente de Diario Necochea via la API de WordPress.

Cambiar de raspar la portada a pegarle a /wp-json/wp/v2/posts no es un
detalle: la portada se caia y la API no. Estos tests fijan el mapeo de los
campos, que es donde se pueden perder datos en silencio.
"""

import pytest
import requests

from scraper import fetch
from scraper.config import SOURCES


def _post(**over):
    base = {
        "title": {"rendered": "Una nota de prueba"},
        "link": "https://diarionecochea.com/2026/09/30/una-nota-de-prueba/",
        "date_gmt": "2026-09-30T13:55:20",
        "excerpt": {"rendered": "<p>El resumen.</p>"},
        "content": {"rendered": "<p>El cuerpo completo, mas largo.</p>"},
        "_embedded": {
            "wp:term": [[{"name": "Locales"}], [{"name": "etiqueta"}]],
            "wp:featuredmedia": [{"source_url": "https://diarionecochea.com/foto.jpg"}],
        },
    }
    base.update(over)
    return base


class _Resp:
    def __init__(self, payload):
        self._payload = payload
        self.status_code = 200
        self.text = ""

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


@pytest.fixture
def fuente():
    return next(s for s in SOURCES if s["name"] == "Diario Necochea")


def test_la_fuente_ya_no_raspa_la_portada(fuente):
    """El arreglo del portal caido: HTML -> API."""
    assert fuente["type"] == "wpjson"
    assert "article_selector" not in fuente


def test_mapea_todos_los_campos(monkeypatch, fuente):
    urls = {}

    def get(url, headers=None, timeout=None, params=None):
        urls["url"] = url
        urls["params"] = params
        return _Resp([_post()])

    monkeypatch.setattr(fetch.requests, "get", get)

    notas = fetch.fetch_source(fuente)

    assert len(notas) == 1
    n = notas[0]
    assert n["title"] == "Una nota de prueba"
    assert n["portal"] == "Diario Necochea"
    # con zona horaria: el agrupador resta fechas de distintas fuentes
    assert n["published_at"] == "2026-09-30T13:55:20+00:00"
    assert n["category"] == "Locales"
    assert n["image"] == "https://diarionecochea.com/foto.jpg"
    assert urls["url"].endswith("/wp-json/wp/v2/posts")
    assert urls["params"]["_embed"] == "1"


def test_saca_el_html_del_texto(monkeypatch, fuente):
    """El cuerpo llega con etiquetas: al ranking le sirve el texto plano."""
    monkeypatch.setattr(
        fetch.requests, "get",
        lambda *a, **k: _Resp([_post(content={"rendered": "<p>Hola <b>mundo</b></p>"})]),
    )

    n = fetch.fetch_source(fuente)[0]

    assert "<" not in (n["body"] or "")
    assert "Hola" in n["body"] and "mundo" in n["body"]


def test_se_pasa_a_un_post_sin_imagen(monkeypatch, fuente):
    """No todas las notas tienen foto y no puede romper la pasada."""
    monkeypatch.setattr(
        fetch.requests, "get",
        lambda *a, **k: _Resp([_post(_embedded={})]),
    )

    n = fetch.fetch_source(fuente)[0]

    assert n["image"] is None
    assert n["title"] == "Una nota de prueba"


def test_ignora_un_post_sin_titulo_o_sin_link(monkeypatch, fuente):
    """Un post a medio guardar no debe romper la fuente entera."""
    monkeypatch.setattr(
        fetch.requests, "get",
        lambda *a, **k: _Resp([
            _post(title={"rendered": "   "}),
            _post(link=""),
            _post(title={"rendered": "Esta si cuenta"}),
        ]),
    )

    notas = fetch.fetch_source(fuente)

    assert len(notas) == 1
    assert notas[0]["title"] == "Esta si cuenta"


def test_avisa_si_la_api_no_devuelve_una_lista(monkeypatch, fuente):
    """Si responden un error en JSON hay que decirlo, no publicarlo vacío."""
    monkeypatch.setattr(
        fetch.requests, "get",
        lambda *a, **k: _Resp({"code": "rest_forbidden", "message": "no"}),
    )

    with pytest.raises(RuntimeError, match="no una lista"):
        fetch.fetch_source(fuente)

def test_la_fecha_siempre_lleva_zona_horaria(monkeypatch, fuente):
    """La API manda date_gmt sin zona. Si se escapa asi, el agrupador revienta
    al restar contra fechas de otras fuentes que si la traen."""
    monkeypatch.setattr(fetch.requests, "get", lambda *a, **k: _Resp([_post()]))

    n = fetch.fetch_source(fuente)[0]

    from datetime import datetime
    assert datetime.fromisoformat(n["published_at"]).tzinfo is not None
