#!/usr/bin/env python3
"""Update the 365-day NASA HMI score and open the local player."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import fcntl
from http.client import HTTPException
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
import webbrowser

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
API = 'https://api.helioviewer.org/v2'
PREFIX = 'window.solarObservations = '


def request_bytes(url):
    for attempt in range(2):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'SolarSonification/1.0'}), timeout=18) as response:
                return response.read()
        except (URLError, TimeoutError, HTTPException):
            if attempt:
                raise
            time.sleep(1)


def analyze(day, meta, raw):
    if meta['date'][:10] != day or meta.get('name') != 'HMI Int':
        raise ValueError('No matching daily continuum frame')
    with Image.open(BytesIO(raw)) as image:
        gray = np.asarray(image.convert('L'))
    height, width = gray.shape
    if (width, height) != (768, 768):
        raise ValueError('Unexpected image dimensions')
    scale = width / meta['width']
    radius = meta['rsun'] * scale
    cx = (meta['refPixelX'] - .5) * scale
    cy = height - (meta['refPixelY'] - .5) * scale
    y, x = np.ogrid[:height, :width]
    dist = np.hypot(x + .5 - cx, y + .5 - cy) / radius
    inside = dist < .96
    if not (.34 * width < radius < .46 * width and inside.mean() > .30):
        raise ValueError('Unusable disk geometry')
    ring = np.floor(dist[inside] * 40).astype(int)
    hist = np.bincount(ring * 256 + gray[inside], minlength=40 * 256).reshape(40, 256)
    medians = np.argmax(hist.cumsum(1) > hist.sum(1)[:, None] / 2, axis=1)
    background = medians[ring]
    if np.min(background) < 70 or (gray[inside] < background * .55).mean() > .012:
        raise ValueError('Obscured or incomplete solar disk')
    dark = np.zeros(gray.shape, dtype=bool)
    dark[inside] = gray[inside] < background * .76
    labels, count = ndimage.label(dark, structure=np.ones((3, 3)))
    areas = np.bincount(labels.ravel(), minlength=count+1)[1:]
    if areas.size and areas.max() > inside.sum() * .009:
        raise ValueError('Dark artifact obscures the disk')
    ids = np.flatnonzero(areas >= 3) + 1
    centers = ndimage.center_of_mass(dark, labels, ids) if ids.size else []
    spots = []
    for label, (py, px) in zip(ids, centers):
        spots.append([round((px+.5-cx)/radius, 3), round((cy-py-.5)/radius, 3), int(areas[label-1])])
    spots.sort(key=lambda spot: -spot[2])
    return {'date': day, 'id': int(meta['id']), 'time': meta['date'], 'spots': spots}


def fetch_day(day):
    try:
        meta = json.loads(request_bytes(f'{API}/getClosestImage/?sourceId=18&date={day}T03:00:00Z'))
        if meta.get('date', '')[:10] != day:
            # An early gap can still have a usable exposure later that day.
            meta = json.loads(request_bytes(f'{API}/getClosestImage/?sourceId=18&date={day}T12:00:00Z'))
        if meta.get('date', '')[:10] != day:
            return {'date': day, 'reason': 'No same-day image returned'}
        raw = request_bytes(f'{API}/downloadImage/?id={int(meta["id"])}&width=768&type=png')
        return analyze(day, meta, raw)
    except (ValueError, KeyError, OSError, TypeError, HTTPException) as error:
        return {'date': day, 'reason': f'Image unavailable: {error}'}


def write_snapshot(rows):
    with tempfile.NamedTemporaryFile('w', dir=ROOT, delete=False, encoding='utf-8') as target:
        try:
            target.write(PREFIX + json.dumps(rows, separators=(',', ':')) + ';\n')
            target.flush()
            os.fsync(target.fileno())
        except BaseException:
            Path(target.name).unlink(missing_ok=True)
            raise
    os.replace(target.name, ROOT/'observations.js')


def refresh():
    path = ROOT/'observations.js'
    records = {}
    if path.exists():
        old = json.loads(path.read_text().removeprefix(PREFIX).strip().removesuffix(';'))
        records = {r['date']: r for r in old if 'spots' in r}
    today = datetime.now(timezone.utc).date()
    days = [str(today - timedelta(days=offset)) for offset in reversed(range(365))]
    pending = [day for day in days if day not in records]
    if not pending:
        return
    print(f'Checking {len(pending)} daily HMI images…', flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for row in pool.map(fetch_day, pending):
            records[row['date']] = row
    rows = [records[d] for d in days]
    if any('spots' in row for row in rows) or not path.exists():
        write_snapshot(rows)
    print(f'{sum("spots" in row for row in rows)} of 365 dates have usable images.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-open', action='store_true', help='refresh observations without opening a browser')
    args = parser.parse_args()
    lock = os.open(ROOT, os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        refresh()
    finally:
        os.close(lock)
    if not args.no_open:
        webbrowser.open((ROOT/'index.html').as_uri())
