# Repository Guidelines

## Project Structure & Module Organization
- `webapp/` holds the static Leaflet client (`index.html`, `style.css`, `app.js`) plus the generated `cells.json` consumed by the UI.
- `scripts/build_cells.py` downloads the latest Waymo CSV and transforms it into S2 cell features (saved under `data/` before conversion).
- `data/` contains the fetched CSV export; it is gitignored automatically, so keep only the most recent file locally.
- `requirements.txt` tracks the small Python toolchain (primarily `s2sphere`) needed for preprocessing.

## Build, Test, and Development Commands
- `pip install -r requirements.txt` primes the preprocessing environment (run inside your preferred virtualenv).
- `python scripts/build_cells.py` fetches the upstream CSV, rewrites `webapp/cells.json` with the latest metrics, and prints the cell count for sanity.
- From `webapp/`, run `npx serve .` or `python -m http.server 8000` to preview the map locally and exercise the controls.
- Optional: `python -m json.tool webapp/cells.json` confirms the JSON payload before committing.

## Coding Style & Naming Conventions
- Python uses 4-space indentation, type hints, and lowercase `snake_case`; keep constants uppercase (`TARGET_LEVEL`) and operations pathlib-based.
- JavaScript favors `const`/`let`, camelCase helpers (`populateControls`), and template literals for HTML; avoid introducing a bundler.
- CSS selectors in `webapp/style.css` use hyphen-case class names; scope new rules under existing structural elements.

## Testing Guidelines
- After regenerating `cells.json`, load the local server and toggle every location/metric; polygons, legends, and popovers should update smoothly.
- Compare a few tooltip values against the CSV to validate rounding and null handling, especially for new outcomes.
- Keep devtools open to watch for fetch errors or unhandled promise rejections during `bootstrap()`.

## Commit & Pull Request Guidelines
- Use imperative, present-tense commit subjects (e.g., `Add Austin crash severity toggle`) and keep bodies focused on intent and impact.
- Document the CSV vintage or Waymo report date in PR descriptions, and note any manual follow-up steps such as rerunning `build_cells.py`.
- Attach screenshots or short clips for UI work so reviewers can verify map, legends, and control states quickly.

## Data Refresh Checklist
- Confirm the upstream CSV still exposes `Location`, `Outcome`, `Waymo RO Miles`, and related headers; the build script will download the file when it runs.
- Commit the regenerated `webapp/cells.json` alongside code changes while keeping bulky raw CSVs out of version control.
- Call out upstream quirks (nulls, renamed outcomes) in the PR so the front-end logic can adapt without surprises.
