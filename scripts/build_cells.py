import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List
from urllib.request import urlopen

from s2sphere import Cell, CellId, LatLng

DATA_URL = (
    "https://storage.googleapis.com/waymo-uploads/files/documents/safety/"
    "safety-impact-data/CSV4%20-%20Miles%20and%20Benchmark%20Crashes%20for%20Dynamic%20"
    "Benchmark%20202009-202506-2022benchmark.csv"
)

DATA_PATH = Path(
    "data/CSV4 - Miles and Benchmark Crashes for Dynamic Benchmark 202009-202506-2022benchmark.csv"
)
OUTPUT_PATH = Path("webapp/cells.json")
TARGET_LEVEL = 13

MetricDict = Dict[str, float]
CellEntry = Dict[str, object]


def load_rows() -> List[Dict[str, str]]:
    with DATA_PATH.open(newline="") as fh:
        reader = csv.DictReader(fh)
        return list(reader)


def download_source_csv() -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading source CSV from {DATA_URL}...")
    with urlopen(DATA_URL) as response:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError(
                f"Failed to download source CSV (status {getattr(response, 'status', 'unknown')})"
            )
        payload = response.read()
    DATA_PATH.write_bytes(payload)
    size_kb = len(payload) / 1024
    print(f"Saved {DATA_PATH} ({size_kb:.1f} KiB)")


def build_cells(rows: List[Dict[str, str]]) -> Dict[str, Dict[str, CellEntry]]:
    grouped: Dict[str, Dict[str, CellEntry]] = defaultdict(dict)

    for row in rows:
        location = row["Location"].upper()
        cell_id_int = int(row["S2 Cell"])
        outcome = row["Outcome"].strip()
        benchmark_crash_count = float(row["Benchmark Crash Count"])
        hpms_vmt = float(row["HPMS Yearly Vehicle Miles Traveled"])
        waymo_miles = float(row["Waymo RO Miles"])

        cell_id = CellId(cell_id_int).parent(TARGET_LEVEL)
        cell_token = cell_id.to_token()

        location_cells = grouped[location]
        entry = location_cells.get(cell_token)
        if entry is None:
            cell = Cell(cell_id)
            vertices = []
            for i in range(4):
                vertex_latlng = LatLng.from_point(cell.get_vertex(i))
                vertices.append([
                    round(vertex_latlng.lat().degrees, 8),
                    round(vertex_latlng.lng().degrees, 8),
                ])
            center_latlng = cell_id.to_lat_lng()

            entry = {
                "id": str(cell_id.id()),
                "token": cell_token,
                "center": [
                    round(center_latlng.lat().degrees, 8),
                    round(center_latlng.lng().degrees, 8),
                ],
                "vertices": vertices,
                "metrics": {},
                "hpms_vehicle_miles_traveled": hpms_vmt,
                "waymo_ro_miles": waymo_miles,
            }
            location_cells[cell_token] = entry
        else:
            entry["hpms_vehicle_miles_traveled"] = hpms_vmt
            entry["waymo_ro_miles"] = waymo_miles

        entry["metrics"][outcome] = benchmark_crash_count

    return grouped


def compute_location_centers(cells_by_location: Dict[str, Dict[str, CellEntry]]) -> Dict[str, object]:
    output: Dict[str, object] = {}
    for location, cells in cells_by_location.items():
        if not cells:
            continue
        lat_total = 0.0
        lng_total = 0.0
        for entry in cells.values():
            lat_total += entry["center"][0]
            lng_total += entry["center"][1]
        count = len(cells)
        output[location] = {
            "center": [round(lat_total / count, 6), round(lng_total / count, 6)],
            "cells": list(cells.values()),
        }
    return output


def main() -> None:
    download_source_csv()
    rows = load_rows()
    cells = build_cells(rows)
    export = compute_location_centers(cells)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as fh:
        json.dump(export, fh, indent=2)
    print(f"Wrote {OUTPUT_PATH} with {sum(len(v['cells']) for v in export.values())} cells")


if __name__ == "__main__":
    main()
