"""Pruebas de continuidad de claves entre corridas (comentarios que sobreviven)."""

from scraper.continuity import inherit_keys
from scraper.config import CONTINUITY_THRESHOLD


def _story(key: str, title: str) -> dict:
    return {"key": key, "title": title, "articles": []}


def test_misma_noticia_con_otro_titulo_hereda_clave():
    viejas = [_story("refuerzan educacion vial ordenamiento transito", "Refuerzan educación vial: ordenamiento de tránsito")]
    nuevas = [_story("mas controles educacion vial transito", "Más controles de educación vial en el tránsito")]
    resultado = inherit_keys(nuevas, viejas)
    assert resultado[0]["key"] == "refuerzan educacion vial ordenamiento transito"


def test_noticia_distinta_mantiene_su_clave():
    viejas = [_story("refuerzan educacion vial", "Refuerzan educación vial")]
    nuevas = [_story("robaron moto en avenida 59", "Robaron una moto en Avenida 59")]
    resultado = inherit_keys(nuevas, viejas)
    assert resultado[0]["key"] == "robaron moto en avenida 59"


def test_sin_corridas_anteriores_no_cambia_nada():
    nuevas = [_story("solo una noticia nueva", "Solo una noticia nueva")]
    resultado = inherit_keys(nuevas, None)
    assert resultado[0]["key"] == "solo una noticia nueva"


def test_exacta_igual_mantiene_clave():
    viejas = [_story("titulo identico", "Título idéntico")]
    nuevas = [_story("titulo identico", "Título idéntico")]
    resultado = inherit_keys(nuevas, viejas)
    assert resultado[0]["key"] == "titulo identico"


def test_umbral_no_alcanzado_no_hereda():
    viejas = [_story("festejo costanera", "Festejo en la costanera")]
    nuevas = [_story("robo en comercio", "Robo en un comercio del centro")]
    resultado = inherit_keys(nuevas, viejas)
    assert resultado[0]["key"] == "robo en comercio"


def test_dos_nuevas_no_roban_la_misma_clave_vieja():
    viejas = [_story("educacion vial necochea", "Educación vial en Necochea")]
    nuevas = [
        _story("educacion vial necochea multas", "Educación vial en Necochea: nuevas multas"),
        _story("educacion vial necochea escuelas", "Educación vial en Necochea para escuelas"),
    ]
    resultado = inherit_keys(list(nuevas), viejas)
    claves = [s["key"] for s in resultado]
    # una hereda la clave vieja, la otra conserva la suya
    assert claves.count("educacion vial necochea") == 1