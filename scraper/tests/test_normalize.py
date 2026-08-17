from scraper.normalize import normalize_title


def test_minusculas_y_espacios():
    assert normalize_title("  Un   TITULAR   de Prueba  ") == "titular prueba"


def test_quita_acentos():
    assert normalize_title("Necochea: fin de semana con lluvias") == "necochea fin semana lluvias"


def test_quita_puntuacion():
    assert normalize_title("¿Qué pasó en Necochea? ¡Mirá!") == "paso necochea mira"


def test_quita_stopwords():
    assert normalize_title("El intendente de Necochea anunció la obra") == "intendente necochea anuncio obra"


def test_titulares_equivalentes_se_normalizan_igual():
    a = normalize_title("Choque en la Avenida 58, dejó dos heridos.")
    b = normalize_title("Choque en la avenida 58 dejó dos heridos")
    assert a == b


def test_vacio_si_solo_stopwords():
    assert normalize_title("El y la de los") == ""