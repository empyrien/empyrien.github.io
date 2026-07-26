#!/usr/bin/env python3
"""Generate the inline QR SVG used in a Feast programme's .qr-frame.

    pip install segno
    python3 tools/make-qr.py https://empyrien.com/feast/kalimat/

Prints the SVG to stdout. Colours come from the stylesheet, so the markup here
carries geometry only. Error correction is level H, which keeps the code
readable even though the three corner eyes are drawn as rounded shapes.
"""
import sys

import segno

QUIET = 4  # modules of quiet zone on every side


def build(url):
    matrix = [list(row) for row in segno.make(url, error="h").matrix]
    n = len(matrix)
    size = n + 2 * QUIET
    finders = [(0, 0), (0, n - 7), (n - 7, 0)]

    def in_finder(r, c):
        return any(fr <= r < fr + 7 and fc <= c < fc + 7 for fr, fc in finders)

    dots = [
        f'<rect x="{c + QUIET}" y="{r + QUIET}" width="1" height="1" rx="0.26"/>'
        for r in range(n)
        for c in range(n)
        if matrix[r][c] and not in_finder(r, c)
    ]

    eyes = []
    for fr, fc in finders:
        x, y = fc + QUIET, fr + QUIET
        eyes.append(f'<rect class="eo" x="{x + 0.5}" y="{y + 0.5}" width="6" height="6" rx="1.9"/>')
        eyes.append(f'<rect class="ei" x="{x + 2}" y="{y + 2}" width="3" height="3" rx="1"/>')

    return (
        f'<svg class="qr" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg" '
        f'role="img" aria-label="QR code linking to this page">'
        f'<rect class="qbg" x="0" y="0" width="{size}" height="{size}" rx="3"/>'
        f'<g class="qm">{"".join(dots)}</g>'
        f'<g class="qe">{"".join(eyes)}</g>'
        f"</svg>"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(build(sys.argv[1]))
