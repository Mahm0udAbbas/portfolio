"""
Download the CC0 Poly Haven assets used by the Experience ski run (https://polyhaven.com, CC0 licence).

    python -I tools/fetch_polyhaven.py

Raw downloads -> blender/assets/polyhaven/ (gitignored, used by blender/build_ski_run.py)
Web copies    -> public/textures/ski/ and public/hdri/ (shipped with the site)
"""
import json
import pathlib
import shutil
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "blender" / "assets" / "polyhaven"
WEB_TEX = ROOT / "public" / "textures" / "ski"
WEB_HDRI = ROOT / "public" / "hdri"
UA = {"User-Agent": "portfolio-asset-fetch"}

TEXTURES = {  # asset id -> maps to fetch (1k jpg)
    "snow_field_aerial": ["Diffuse", "nor_gl", "Rough"],
    "aerial_rocks_02": ["Diffuse", "nor_gl", "Rough"],
}
HDRI = "lago_disola"
WEB_MAPS = {"Diffuse": "diff"}  # the site only needs colour (normals add little from a high camera)


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def download(url, dest: pathlib.Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return dest


def main():
    for asset, maps in TEXTURES.items():
        files = get_json(f"https://api.polyhaven.com/files/{asset}")
        for m in maps:
            url = files[m]["1k"]["jpg"]["url"]
            raw = download(url, RAW / asset / f"{asset}_{m}_1k.jpg")
            if m in WEB_MAPS:
                WEB_TEX.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(raw, WEB_TEX / f"{asset}_{WEB_MAPS[m]}.jpg")
            print("ok", raw.name, raw.stat().st_size)
    files = get_json(f"https://api.polyhaven.com/files/{HDRI}")
    raw = download(files["hdri"]["1k"]["hdr"]["url"], RAW / HDRI / f"{HDRI}_1k.hdr")
    WEB_HDRI.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(raw, WEB_HDRI / f"{HDRI}_1k.hdr")
    print("ok", raw.name, raw.stat().st_size)


if __name__ == "__main__":
    main()
