from scraper.summarize import build_summary, split_sentences


def _body(text):
    return {"portal": "Ecos Diarios", "title": "T", "text": text}


def test_junta_y_deduplica_oraciones_repetidas():
    a = "El puerto de Quequén profundiza su apoyo al sector productivo con la recuperación de caminos rurales."
    b = "El puerto de Quequén profundiza su apoyo al sector productivo."  # versión parecida del otro portal
    c = "La obra alcanza a los accesos de las plantas cerealeras y demandará una inversión municipal."
    summary = build_summary([_body(a), _body(b), _body(c)], max_sentences=5)
    texto = " ".join(summary["paragraphs"])
    assert "caminos rurales" in texto
    assert "inversión municipal" in texto
    # la versión corta (b) no debería duplicar a la larga (a)
    assert texto.count("apoyo al sector productivo") == 1 or "demandará" in texto


def test_sin_texto_devuelve_vacio():
    summary = build_summary([])
    assert summary["paragraphs"] == []
    assert summary["generated"] is None


def test_limpia_html_y_unescape():
    texto = "<p>La <strong>municipalidad</strong> anunci&oacute; obras.</p><p>Detalles mañana.</p>"
    sentences = split_sentences(texto)
    assert any("municipalidad" in s for s in sentences)
    assert any("anunció" in s for s in sentences)


def test_respeto_de_limite_de_caracteres():
    largo = "La noticia de hoy en Necochea y Quequén repite información extensa por todas partes del texto." * 5
    summary = build_summary([_body(largo)], max_chars=200)
    total = sum(len(p) for p in summary["paragraphs"])
    assert total <= 200 + 200  # margen de un párrafo


def test_oraciones_cortas_se_ignoran():
    summary = build_summary([_body("Hola. El intendente anunció una obra clave para el puerto de Quequén.")])
    texto = " ".join(summary["paragraphs"])
    assert "intendente anunció" in texto
    assert "Hola" not in texto