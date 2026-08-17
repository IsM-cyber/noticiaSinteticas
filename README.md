# Noticias Sintéticas

Portal que junta las noticias de los portales de **Necochea y Quequén**, detecta las de
mayor **resonancia** (la misma noticia publicada por varios portales a la vez) y las
ordena por relevancia en una página web propia.

## Cómo funciona

```
GitHub Actions (cada 30 min)
        │  corre scraper/ (Python)
        ▼
data/news.json  ──►  sitio Next.js  ──►  Vercel (público)
```

- **Scraper** (`scraper/`): lee 7 fuentes por RSS/Atom + 2 por HTML, normaliza los
  titulares (minúsculas, sin acentos, sin palabras vacías), agrupa la misma noticia
  (título idéntico o similitud alta en ventana de 36 h) y la puntúa:
  `suma(ponderación del portal) × (1 + 0.25 × (fuentes − 1)) × frescura`.
- **Sitio** (`app/`): Next.js; lee `data/news.json` y muestra el ranking + un feed RSS.

## Fuentes

| Portal | Tipo |
|---|---|
| Ecos Diarios (elecos.com.ar) | RSS |
| Diario Necochea (diarionecochea.com) | HTML |
| Necochea Digital (necocheadigital.com) | HTML |
| TSN Necochea (tsnnecochea.com.ar) | RSS |
| Necochea Libre (necochealibre.com.ar) | RSS |
| Noticias de Necochea (nden.com.ar) | RSS |
| Necochea News (necocheanews.com.ar) | RSS |
| Diario NQ (diarionq.com.ar) | RSS |
| Informate Necochea (informatenecochea.com) | HTML (React incrustado) |

## Correr en local

```bash
# 1) el robot (juntar noticias)
python3 -m venv .venv
.venv/bin/pip install -r scraper/requirements.txt
.venv/bin/python -m scraper.main          # escribe data/news.json

# 2) tests
.venv/bin/python -m pytest scraper/tests

# 3) el sitio
npm install
npm run dev                               # http://localhost:3000
```

## Ajustar el ranking

Todo se tunca en `scraper/config.py`:

- `SOURCES`: agregar/quitar portales y cambiar `weight` (ponderación).
- `CLUSTER_WINDOW_HOURS`: ventana para considerar dos artículos la misma noticia.
- `JACCARD_THRESHOLD`: similitud mínima de titulares para agrupar.
- `FRESHNESS_HALFLIFE_HOURS`: a las N horas una noticia pierde la mitad de frescura.
- `MAX_STORIES`: cuántas noticias muestra el ranking.

## ¿Se rompió un portal?

Si un portal cambió su página, el scraper avisa en `data/news.json` → `fetch_errors`
y las demás fuentes siguen funcionando. Para arreglarlo, ajustar los selectores
(`article_selector`, `title_selector`, `link_selector`) de esa fuente en
`scraper/config.py`.

## Deploy

1. Subir el repo a GitHub.
2. El workflow `.github/workflows/scrape.yml` corre el robot cada 30 min y
   commitea `data/news.json`.
3. Importar el repo en Vercel (framework: Next.js) → queda público en
   `noticias-sinteticas.vercel.app`. No hace falta ninguna API key.