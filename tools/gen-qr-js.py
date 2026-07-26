#!/usr/bin/env python3
"""Emit feast/qr.js — a byte-mode QR encoder whose tables come straight out of
segno, so no spec numbers are typed from memory."""
from segno import consts

M = consts.ERROR_LEVEL_M
MAX_VERSION = 12

# --- error-correction block layout, per version, at level M -----------------
# Flattened to [ [numBlocks, numTotal, numData], ... ] per version.
ecc_rows = []
for v in range(1, MAX_VERSION + 1):
    groups = consts.ECC[v][M]
    ecc_rows.append([[g.num_blocks, g.num_total, g.num_data] for g in groups])

# --- alignment pattern centres ---------------------------------------------
align_rows = [[]]  # version 1 has none
for v in range(2, MAX_VERSION + 1):
    align_rows.append(list(consts.ALIGNMENT_POS[v - 2]))

# --- format info, indexed [ecIndex][mask]; segno orders L,M,Q,H -------------
# consts.FORMAT_INFO is a flat 32-tuple: 4 levels x 8 masks, but segno's own
# index order is what calc_format_info uses. Derive it rather than assume.
from segno import encoder as enc

format_info = [enc.calc_format_info(1, M, m) for m in range(8)]

version_info = {}
for v in range(7, MAX_VERSION + 1):
    version_info[v] = consts.VERSION_INFO[v - 7]

gen_poly = {k: list(consts.GEN_POLY[k]) for k in sorted(consts.GEN_POLY)}
galois_exp = list(consts.GALIOS_EXP)
galois_log = list(consts.GALIOS_LOG)


def js(o):
    import json
    return json.dumps(o, separators=(",", ":"))


TEMPLATE = '''/* ============================================================
   Minimal QR encoder — byte mode, error-correction level M,
   versions 1 to %(maxv)d (up to %(maxbytes)d bytes).

   Enough to put the evening's reader assignments into the QR code on the
   page, so a phone that scans it gets the programme *and* the list.

   The tables below were emitted from the `segno` library by
   tools/gen-qr-js.py, and the output of this encoder is checked
   module-for-module against segno — see tools/verify-qr.py.
   ============================================================ */
window.FeastQR = (function () {
  "use strict";

  /* [ [blocks, totalCodewords, dataCodewords], ... ] per version at level M */
  var ECC = %(ecc)s;
  var ALIGN = %(align)s;
  var FORMAT = %(format)s;      /* by mask 0-7, level M */
  var VERSION_INFO = %(vinfo)s; /* version >= 7 */
  var GEN = %(gen)s;
  var EXP = %(exp)s;
  var LOG = %(log)s;

  function dataCapacity(version) {
    var total = 0;
    ECC[version - 1].forEach(function (g) { total += g[0] * g[2]; });
    return total;
  }

  /* --- Reed-Solomon ------------------------------------------------- */

  /* GEN holds the generator polynomial as alpha exponents, so its entries go
     straight into the exponent sum — no second log. */
  function rsRemainder(data, degree) {
    var gen = GEN[degree];
    var res = new Array(degree).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        var lf = LOG[factor];
        for (var j = 0; j < degree; j++) {
          res[j] ^= EXP[(gen[j] + lf) %% 255];
        }
      }
    }
    return res;
  }

  /* --- bit stream --------------------------------------------------- */

  function toBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        var cp = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
                 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function buildCodewords(bytes, version) {
    var capacity = dataCapacity(version);
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    push(4, 4);                                   /* byte mode */
    push(bytes.length, version < 10 ? 8 : 16);    /* character count */
    bytes.forEach(function (b) { push(b, 8); });

    var limit = capacity * 8;
    for (var t = 0; t < 4 && bits.length < limit; t++) bits.push(0);
    while (bits.length %% 8 !== 0) bits.push(0);

    var codewords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    var pad = [0xec, 0x11];
    for (var k = 0; codewords.length < capacity; k++) codewords.push(pad[k %% 2]);
    return codewords;
  }

  /* Split into blocks, add error correction, then interleave. */
  function finalMessage(codewords, version) {
    var groups = ECC[version - 1];
    var blocks = [];
    var pos = 0;
    groups.forEach(function (g) {
      var count = g[0], total = g[1], dataLen = g[2];
      for (var i = 0; i < count; i++) {
        var data = codewords.slice(pos, pos + dataLen);
        pos += dataLen;
        blocks.push({ data: data, ec: rsRemainder(data, total - dataLen) });
      }
    });

    var maxData = 0, maxEc = 0;
    blocks.forEach(function (b) {
      maxData = Math.max(maxData, b.data.length);
      maxEc = Math.max(maxEc, b.ec.length);
    });

    var out = [];
    for (var i = 0; i < maxData; i++) {
      blocks.forEach(function (b) { if (i < b.data.length) out.push(b.data[i]); });
    }
    for (var j = 0; j < maxEc; j++) {
      blocks.forEach(function (b) { if (j < b.ec.length) out.push(b.ec[j]); });
    }
    return out;
  }

  /* --- matrix ------------------------------------------------------- */

  function newMatrix(size) {
    var m = [];
    for (var i = 0; i < size; i++) m.push(new Array(size).fill(null));
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
        var inner = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        m[rr][cc] = (inner !== 2 && inner !== 4) ? 1 : 0;
      }
    }
  }

  function functionPatterns(version) {
    var size = version * 4 + 17;
    var m = newMatrix(size);

    placeFinder(m, 0, 0);
    placeFinder(m, 0, size - 7);
    placeFinder(m, size - 7, 0);

    for (var i = 8; i < size - 8; i++) {
      m[6][i] = m[i][6] = (i %% 2 === 0) ? 1 : 0;
    }

    var centres = ALIGN[version - 1];
    centres.forEach(function (r) {
      centres.forEach(function (c) {
        /* The three centres that sit under a finder are omitted. Testing for
           an already-written module would also wrongly skip the ones lying on
           the timing row or column. */
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) ||
            (r === size - 7 && c === 6)) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0;
          }
        }
      });
    });

    /* Reserve the two format-information areas: row 8 and column 8, at both
       the top-left corner and the far edges. */
    for (var k = 0; k <= 8; k++) {
      if (m[8][k] === null) m[8][k] = 0;
      if (m[k][8] === null) m[k][8] = 0;
    }
    for (var e = 0; e < 8; e++) {
      if (m[8][size - 1 - e] === null) m[8][size - 1 - e] = 0;
      if (m[size - 1 - e][8] === null) m[size - 1 - e][8] = 0;
    }
    m[size - 8][8] = 1; /* dark module */

    if (version >= 7) {
      var info = VERSION_INFO[version];
      for (var b = 0; b < 18; b++) {
        var bit = (info >> b) & 1;
        var a = Math.floor(b / 3), d = b %% 3;
        m[size - 11 + d][a] = bit;
        m[a][size - 11 + d] = bit;
      }
    }
    return m;
  }

  function placeData(m, reserved, codewords) {
    var size = m.length;
    var bit = 0;
    var total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; /* the vertical timing column is skipped */
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          var upward = ((right + 1) & 2) === 0;
          var row = upward ? size - 1 - vert : vert;
          if (reserved[row][col] !== null) continue;
          var value = 0;
          if (bit < total) value = (codewords[bit >> 3] >> (7 - (bit & 7))) & 1;
          m[row][col] = value;
          bit++;
        }
      }
    }
  }

  var MASKS = [
    function (r, c) { return (r + c) %% 2 === 0; },
    function (r) { return r %% 2 === 0; },
    function (r, c) { return c %% 3 === 0; },
    function (r, c) { return (r + c) %% 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) %% 2 === 0; },
    function (r, c) { return ((r * c) %% 2) + ((r * c) %% 3) === 0; },
    function (r, c) { return (((r * c) %% 2) + ((r * c) %% 3)) %% 2 === 0; },
    function (r, c) { return (((r + c) %% 2) + ((r * c) %% 3)) %% 2 === 0; }
  ];

  function penalty(m) {
    var size = m.length, score = 0, r, c, i;

    /* rule 1 — runs of five or more */
    for (r = 0; r < size; r++) {
      for (var dir = 0; dir < 2; dir++) {
        var run = 1;
        for (c = 1; c < size; c++) {
          var cur = dir ? m[c][r] : m[r][c];
          var prev = dir ? m[c - 1][r] : m[r][c - 1];
          if (cur === prev) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
          else run = 1;
        }
      }
    }

    /* rule 2 — 2x2 blocks of one colour */
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    /* rule 3 — finder-like patterns */
    var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function matches(get, start, pattern) {
      for (var k = 0; k < 11; k++) if (get(start + k) !== pattern[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c + 11 <= size; c++) {
        /* eslint-disable no-loop-func */
        var rowGet = (function (rr) { return function (x) { return m[rr][x]; }; })(r);
        var colGet = (function (cc) { return function (x) { return m[x][cc]; }; })(r);
        if (matches(rowGet, c, P1) || matches(rowGet, c, P2)) score += 40;
        if (matches(colGet, c, P1) || matches(colGet, c, P2)) score += 40;
      }
    }

    /* rule 4 — overall balance of dark and light */
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  /* Format bits are counted from the least significant end. The layout below
     was read off segno's output rather than transcribed — see
     tools/derive-format-layout.py. */
  function writeFormat(m, mask) {
    var size = m.length;
    var info = FORMAT[mask];
    function bit(i) { return (info >> i) & 1; }

    /* first copy, hugging the top-left finder */
    for (var i = 0; i <= 5; i++) m[i][8] = bit(i);
    m[7][8] = bit(6);
    m[8][8] = bit(7);
    m[8][7] = bit(8);
    for (var j = 9; j <= 14; j++) m[8][14 - j] = bit(j);

    /* second copy, along the far edges */
    for (var k = 0; k <= 7; k++) m[8][size - 1 - k] = bit(k);
    for (var n = 8; n <= 14; n++) m[size - 15 + n][8] = bit(n);

    m[size - 8][8] = 1; /* dark module */
  }

  function build(text, forceMask) {
    var bytes = toBytes(text);
    var version = 0;
    for (var v = 1; v <= %(maxv)d; v++) {
      var headerBits = 4 + (v < 10 ? 8 : 16);
      if (dataCapacity(v) * 8 >= headerBits + bytes.length * 8) { version = v; break; }
    }
    if (!version) return null; /* too long for the versions we carry */

    var codewords = finalMessage(buildCodewords(bytes, version), version);
    var reserved = functionPatterns(version);

    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      if (forceMask !== undefined && mask !== forceMask) continue;
      var m = reserved.map(function (row) { return row.slice(); });
      placeData(m, reserved, codewords);
      for (var r = 0; r < m.length; r++) {
        for (var c = 0; c < m.length; c++) {
          if (reserved[r][c] === null && MASKS[mask](r, c)) m[r][c] ^= 1;
        }
      }
      writeFormat(m, mask);
      var score = penalty(m);
      if (!best || score < best.score) best = { score: score, matrix: m };
    }
    return best.matrix;
  }

  return {
    build: build,
    maxBytes: %(maxbytes)d,
    /* exposed so tools/verify-qr.py can compare each stage against segno */
    _stages: {
      toBytes: toBytes,
      buildCodewords: buildCodewords,
      finalMessage: finalMessage,
      functionPatterns: functionPatterns,
      dataCapacity: dataCapacity
    }
  };
})();
'''

out = TEMPLATE % {
    "maxv": MAX_VERSION,
    "maxbytes": sum(g[0] * g[2] for g in ecc_rows[MAX_VERSION - 1]) - 3,
    "ecc": js(ecc_rows),
    "align": js(align_rows),
    "format": js(format_info),
    "vinfo": js(version_info),
    "gen": js(gen_poly),
    "exp": js(galois_exp),
    "log": js(galois_log),
}
import sys
sys.stdout.write(out)
