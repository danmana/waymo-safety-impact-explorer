# Waymo Safety Impact Explorer

Simple Leaflet-based web app for exploring Waymo's publicly shared benchmark and Waymo Rider-Only (RO) miles by S2 cell through June 2024.

## Getting Started

1. Install dependencies if you plan to run a local web server (e.g., `npm install -g serve`).
2. From the `webapp` directory, start a static server such as `serve .`.
3. Open the served URL in your browser to interact with the map.

## Data Source

- Geographic distribution of benchmark and Waymo RO miles csv from [Waymo Safety Impact Report](https://waymo.com/safety/impact/#P0-10-3-title)

## Notes

- The map uses Leaflet and OpenStreetMap tiles.
- Polygon fill colors scale per metric and location to highlight higher intensities.
- UI controls let you toggle locations, metrics, and review cell-level metrics via popovers.
- Built with [OpenAI Codex](https://openai.com/codex/)
- `scripts/build_cells.py` automatically downloads the latest CSV into `data/` before regenerating `webapp/cells.json`.

## Updating Cells

1. Ensure Python dependencies (notably `s2sphere`) are installed: `pip install -r requirements.txt`.
2. Run the preprocessing script from the project root (it downloads the latest CSV automatically):

   ```bash
   python scripts/build_cells.py
   ```

   This rewrites `webapp/cells.json` with the updated cells and metrics at S2 level 13.
3. Refresh the web app; the new data will load automatically.
