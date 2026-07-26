/* ============================================================
   Minimal QR encoder — byte mode, error-correction level M,
   versions 1 to 12 (up to 287 bytes).

   Enough to put the evening's reader assignments into the QR code on the
   page, so a phone that scans it gets the programme *and* the list.

   The tables below were emitted from the `segno` library by
   tools/gen-qr-js.py, and the output of this encoder is checked
   module-for-module against segno — see tools/verify-qr.py.
   ============================================================ */
window.FeastQR = (function () {
  "use strict";

  /* [ [blocks, totalCodewords, dataCodewords], ... ] per version at level M */
  var ECC = [[[1,26,16]],[[1,44,28]],[[1,70,44]],[[2,50,32]],[[2,67,43]],[[4,43,27]],[[4,49,31]],[[2,60,38],[2,61,39]],[[3,58,36],[2,59,37]],[[4,69,43],[1,70,44]],[[1,80,50],[4,81,51]],[[6,58,36],[2,59,37]]];
  var ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58]];
  var FORMAT = [21522,20773,24188,23371,17913,16590,20375,19104];      /* by mask 0-7, level M */
  var VERSION_INFO = {"7":31892,"8":34236,"9":39577,"10":42195,"11":48118,"12":51042}; /* version >= 7 */
  var GEN = {"2":[25,1],"5":[113,164,166,119,10],"6":[166,0,134,5,176,15],"7":[87,229,146,149,238,102,21],"8":[175,238,208,249,215,252,196,28],"10":[251,67,46,61,118,70,64,94,32,45],"13":[74,152,176,100,86,100,106,104,130,218,206,140,78],"14":[199,249,155,48,190,124,218,137,216,87,207,59,22,91],"15":[8,183,61,91,202,37,51,58,58,237,140,124,5,99,105],"16":[120,104,107,109,102,161,76,3,91,191,147,169,182,194,225,120],"17":[43,139,206,78,43,239,123,206,214,147,24,99,150,39,243,163,136],"18":[215,234,158,94,184,97,118,170,79,187,152,148,252,179,5,98,96,153],"20":[17,60,79,50,61,163,26,187,202,180,221,225,83,239,156,164,212,212,188,190],"22":[210,171,247,242,93,230,14,109,221,53,200,74,8,172,98,80,219,134,160,105,165,231],"24":[229,121,135,48,211,117,251,126,159,180,169,152,192,226,228,218,111,0,117,232,87,96,227,21],"26":[173,125,158,2,103,182,118,17,145,201,111,28,165,53,161,21,245,142,13,102,48,227,153,145,218,70],"28":[168,223,200,104,224,234,108,180,110,190,195,147,205,27,232,201,21,43,245,87,42,195,212,119,242,37,9,123],"30":[41,173,145,152,216,31,179,182,50,48,110,86,239,96,222,125,42,173,226,193,224,130,156,37,251,216,238,40,192,180]};
  var EXP = [1,2,4,8,16,32,64,128,29,58,116,232,205,135,19,38,76,152,45,90,180,117,234,201,143,3,6,12,24,48,96,192,157,39,78,156,37,74,148,53,106,212,181,119,238,193,159,35,70,140,5,10,20,40,80,160,93,186,105,210,185,111,222,161,95,190,97,194,153,47,94,188,101,202,137,15,30,60,120,240,253,231,211,187,107,214,177,127,254,225,223,163,91,182,113,226,217,175,67,134,17,34,68,136,13,26,52,104,208,189,103,206,129,31,62,124,248,237,199,147,59,118,236,197,151,51,102,204,133,23,46,92,184,109,218,169,79,158,33,66,132,21,42,84,168,77,154,41,82,164,85,170,73,146,57,114,228,213,183,115,230,209,191,99,198,145,63,126,252,229,215,179,123,246,241,255,227,219,171,75,150,49,98,196,149,55,110,220,165,87,174,65,130,25,50,100,200,141,7,14,28,56,112,224,221,167,83,166,81,162,89,178,121,242,249,239,195,155,43,86,172,69,138,9,18,36,72,144,61,122,244,245,247,243,251,235,203,139,11,22,44,88,176,125,250,233,207,131,27,54,108,216,173,71,142,1,2,4,8,16,32,64,128,29,58,116,232,205,135,19,38,76,152,45,90,180,117,234,201,143,3,6,12,24,48,96,192,157,39,78,156,37,74,148,53,106,212,181,119,238,193,159,35,70,140,5,10,20,40,80,160,93,186,105,210,185,111,222,161,95,190,97,194,153,47,94,188,101,202,137,15,30,60,120,240,253,231,211,187,107,214,177,127,254,225,223,163,91,182,113,226,217,175,67,134,17,34,68,136,13,26,52,104,208,189,103,206,129,31,62,124,248,237,199,147,59,118,236,197,151,51,102,204,133,23,46,92,184,109,218,169,79,158,33,66,132,21,42,84,168,77,154,41,82,164,85,170,73,146,57,114,228,213,183,115,230,209,191,99,198,145,63,126,252,229,215,179,123,246,241,255,227,219,171,75,150,49,98,196,149,55,110,220,165,87,174,65,130,25,50,100,200,141,7,14,28,56,112,224,221,167,83,166,81,162,89,178,121,242,249,239,195,155,43,86,172,69,138,9,18,36,72,144,61,122,244,245,247,243,251,235,203,139,11,22,44,88,176,125,250,233,207,131,27,54,108,216,173,71,142];
  var LOG = [0,0,1,25,2,50,26,198,3,223,51,238,27,104,199,75,4,100,224,14,52,141,239,129,28,193,105,248,200,8,76,113,5,138,101,47,225,36,15,33,53,147,142,218,240,18,130,69,29,181,194,125,106,39,249,185,201,154,9,120,77,228,114,166,6,191,139,98,102,221,48,253,226,152,37,179,16,145,34,136,54,208,148,206,143,150,219,189,241,210,19,92,131,56,70,64,30,66,182,163,195,72,126,110,107,58,40,84,250,133,186,61,202,94,155,159,10,21,121,43,78,212,229,172,115,243,167,87,7,112,192,247,140,128,99,13,103,74,222,237,49,197,254,24,227,165,153,119,38,184,180,124,17,68,146,217,35,32,137,46,55,63,209,91,149,188,207,205,144,135,151,178,220,252,190,97,242,86,211,171,20,42,93,158,132,60,57,83,71,109,65,162,31,45,67,216,183,123,164,118,196,23,73,236,127,12,111,246,108,161,59,82,41,157,85,170,251,96,134,177,187,204,62,90,203,89,95,176,156,169,160,81,11,245,22,235,122,117,44,215,79,174,213,233,230,231,173,232,116,214,244,234,168,80,88,175];

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
          res[j] ^= EXP[(gen[j] + lf) % 255];
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
    while (bits.length % 8 !== 0) bits.push(0);

    var codewords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    var pad = [0xec, 0x11];
    for (var k = 0; codewords.length < capacity; k++) codewords.push(pad[k % 2]);
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
      m[6][i] = m[i][6] = (i % 2 === 0) ? 1 : 0;
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
        var a = Math.floor(b / 3), d = b % 3;
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
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
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
    for (var v = 1; v <= 12; v++) {
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
    maxBytes: 287,
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
