#!/usr/bin/env python3
"""Verify the JS QR encoder by decoding what it produces.

Exact-matrix comparison against segno is not a usable oracle here: in byte
mode segno always appends one extra 0x00 pad codeword (write_padding_bits adds
a full byte when the stream is already byte-aligned, which in byte mode it
always is). Both forms are valid symbols, so the real test is whether a
decoder reads back exactly what went in.

Two checks per payload:
  1. OpenCV decodes the rendered symbol back to the original string.
  2. The symbol is no larger than the one segno chooses for the same input,
     so we are not quietly wasting versions.
"""
import json
import random
import string
import subprocess
import sys

import cv2
import numpy as np
import segno

NAMES = ["Rayya", "Nava", "Soraya", "Bahiyyih", "Rúhíyyih", "Jamal",
         "Anisa", "Farhad", "Layli", "Shirin", "Vahid", "Nabil"]
BASE = "https://www.empyrien.com/feast/kalimat/"


def js_matrices(texts):
    runner = """
global.window = {};
const fs = require('fs'), vm = require('vm');
vm.runInThisContext(fs.readFileSync('qr.js','utf8'), {filename:'qr.js'});
const texts = JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(texts.map(t => window.FeastQR.build(t))));
"""
    open("_runner.js", "w").write(runner)
    r = subprocess.run(["node", "_runner.js"], input=json.dumps(texts),
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[:3000])
        sys.exit(1)
    return json.loads(r.stdout)


def render(matrix, scale=8, quiet=4):
    n = len(matrix)
    size = (n + 2 * quiet) * scale
    img = np.full((size, size), 255, dtype=np.uint8)
    for r in range(n):
        for c in range(n):
            if matrix[r][c]:
                y, x = (r + quiet) * scale, (c + quiet) * scale
                img[y:y + scale, x:x + scale] = 0
    return img


def cases():
    rng = random.Random(20260726)
    out = [
        BASE,
        "https://empyrien.com/feast/kalimat/",
        "https://www.empyrien.com/feast/",
        "A",
        "AB",
        "HELLO WORLD 12345",
    ]
    for n in range(1, 13):
        seats = "".join(rng.choice("0123456789ab"[:n]) for _ in range(11))
        out.append(f"{BASE}?f=" + "~".join(NAMES[:n]) + "&s=" + seats)
    # names needing percent-encoding, as real rosters will
    out.append(BASE + "?f=" + "~".join(["R%C3%BAh%C3%ADyyih", "Bah%C3%ADyyih"]) + "&s=01010101010")
    alphabet = string.ascii_letters + string.digits + "-._~:/?#[]@!$&'()*+,;=%"
    for length in list(range(1, 60, 6)) + [80, 120, 160, 200, 240, 270, 287]:
        out.append("".join(rng.choice(alphabet) for _ in range(length)))
    return out


def main():
    texts = cases()
    mats = js_matrices(texts)
    detector = cv2.QRCodeDetector()

    failed = decoded = 0
    versions = set()
    bigger = []

    for text, matrix in zip(texts, mats):
        if matrix is None:
            print(f"FAIL null matrix (len={len(text)})")
            failed += 1
            continue
        version = (len(matrix) - 17) // 4
        versions.add(version)

        got, _, _ = detector.detectAndDecode(render(matrix))
        if got != text:
            failed += 1
            print(f"FAIL decode len={len(text)} v{version}\n  in : {text[:70]}\n  out: {got[:70]}")
        else:
            decoded += 1

        ref = segno.make(text, error="m", boost_error=False, micro=False, mode="byte")
        if len(matrix) > len(ref.matrix):
            bigger.append((len(text), version, ref.version))

    print(f"\ndecoded correctly: {decoded}/{len(texts)}")
    print(f"versions exercised: {sorted(versions)}")
    if bigger:
        print(f"larger than segno for {len(bigger)} inputs: {bigger}")
    return 1 if (failed or bigger) else 0


if __name__ == "__main__":
    sys.exit(main())
