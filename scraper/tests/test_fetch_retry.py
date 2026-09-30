"""Reintentos de red: lo que evita que una fuente se pierda entera.

Diario Necochea corta la conexion TLS de vez en cuando sin estar caido
(SSLEOFError). Con dos intentos nomas la fuente se perdia completa. Estos
tests fijan que un corte pasajero se recupera y que uno permanente se
entrega como error en vez de colgar la pasada entera.
"""

import pytest
import requests

from scraper import fetch


class _FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code


@pytest.fixture
def sin_dormir(monkeypatch):
    """No esperar de verdad: se registra cuanto se hubiera esperado."""
    esperas = []
    monkeypatch.setattr(fetch.time, "sleep", lambda s: esperas.append(s))
    return esperas


def _falla_veces(n, error=None):
    """Devuelve una funcion get que falla las primeras n llamadas."""
    llamadas = {"n": 0}

    def get(url, headers=None, timeout=None):
        llamadas["n"] += 1
        if llamadas["n"] <= n:
            raise (error or requests.ConnectionError("corte de TLS"))
        return _FakeResponse(200)

    get.llamadas = llamadas
    return get


def test_se_recupera_de_un_corte_de_tls(monkeypatch, sin_dormir):
    """Un SSLEOFError en el primer intento no debe perder la fuente."""
    get = _falla_veces(1, requests.exceptions.SSLError("EOF"))
    monkeypatch.setattr(fetch.requests, "get", get)

    resp = fetch._get("https://diarionecochea.com/")

    assert resp.status_code == 200
    assert get.llamadas["n"] == 2


def test_sobrevive_a_dos_cortes_seguidos(monkeypatch, sin_dormir):
    """Dos cortes en cadena: con la config nueva aguanta, antes se perdia."""
    get = _falla_veces(2, requests.exceptions.SSLError("EOF"))
    monkeypatch.setattr(fetch.requests, "get", get)

    resp = fetch._get("https://diarionecochea.com/")

    assert resp.status_code == 200
    assert get.llamadas["n"] == 3


def test_cuatro_intentos_por_defecto():
    """El margen tiene que ser mayor a 2, que es lo que perdia la fuente."""
    assert fetch.RETRY_ATTEMPTS >= 4


def test_la_espera_crece_entre_intentos(monkeypatch, sin_dormir):
    """Si esperara siempre lo mismo, dos cortes pegados noarian."""
    get = _falla_veces(3, requests.exceptions.SSLError("EOF"))
    monkeypatch.setattr(fetch.requests, "get", get)

    fetch._get("https://diarionecochea.com/")

    assert len(sin_dormir) == 3
    assert sin_dormir == sorted(sin_dormir), "las esperas tendrian que crecer"
    assert len(set(sin_dormir)) > 1, "esperar siempre lo mismo no aporta"


def test_el_ultimo_intento_falla_y_propaga(monkeypatch, sin_dormir):
    """Si el portal esta caido de verdad, hay que avisar, no seguir."""
    get = _falla_veces(99, requests.exceptions.SSLError("EOF"))
    monkeypatch.setattr(fetch.requests, "get", get)

    with pytest.raises(requests.exceptions.SSLError):
        fetch._get("https://diarionecochea.com/")

    assert get.llamadas["n"] == fetch.RETRY_ATTEMPTS


def test_reintenta_un_503(monkeypatch, sin_dormir):
    """Los 5xx tambien se reintentan, como los 403 y 429 de siempre."""
    estados = iter([503, 503, 200])

    def get(url, headers=None, timeout=None):
        return _FakeResponse(next(estados))

    monkeypatch.setattr(fetch.requests, "get", get)

    assert fetch._get("https://ejemplo.com/").status_code == 200
