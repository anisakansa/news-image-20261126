// news-image-20261126 — "THE WORLD TODAY"
// A newspaper front page summing up Thursday 26 November 2026.
// Hand-rolled PNG encoder (node:zlib deflate + manual CRC32 table),
// embedded 5x7 bitmap font, RGB buffer render. Fully deterministic:
// no clock, no randomness, no network, no environment-dependent input.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---- palette ----
const PAPER: RGB = [248, 243, 230];
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [19, 38, 77];
const NAVY2: RGB = [31, 78, 121];
const GOLD: RGB = [201, 162, 39];
const RED: RGB = [169, 50, 38];
const GREEN: RGB = [20, 90, 50];
const ORANGE: RGB = [185, 119, 14];
const GREY: RGB = [90, 90, 90];

type RGB = [number, number, number];

// ---- canvas ----
const buf = new Uint8Array(W * H * 3);

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      i += 3;
    }
  }
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB, thick: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(thick / 2);
  for (let n = 0; n < 4096; n++) {
    fillRect(x - half, y - half, thick, thick, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.floor(Math.min(...xs));
      const b = Math.ceil(Math.max(...xs));
      fillRect(a, y, b - a + 1, 1, c);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    const half = Math.floor(rx * Math.sqrt(Math.max(0, t)));
    fillRect(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

// ---- CRC32 (manual table, PNG chunks) ----
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc32(crcData));
  return out;
}

function encodePng(): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, W);
  iv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter none
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))];
  let total = 0;
  for (const p of parts) total += p.length;
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

// ---- 5x7 bitmap font (uppercase ASCII + digits + punctuation) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10011", "10101", "11001", "10001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "00100", "00100", "00100"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  ";": ["00000", "00100", "00000", "00000", "00000", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10010", "01000", "10101", "10010", "01101"],
  "\u2022": ["00000", "01110", "01110", "01110", "00000", "00000", "00000"],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  const upper = text.toUpperCase();
  let cx = x;
  for (const ch of upper) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCenter(x: number, y: number, width: number, text: string, scale: number, c: RGB): void {
  const w = textWidth(text, scale);
  drawText(x + Math.floor((width - w) / 2), y, text, scale, c);
}

function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawWrapped(x: number, y: number, text: string, maxWidth: number, scale: number, pitch: number, c: RGB, maxLines: number): void {
  const lines = wrapText(text, maxWidth, scale).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * pitch, lines[i], scale, c);
  }
}

// ---- pictograms (drawn inside the lead panels, ~96 px tall) ----

// 1. Falling market chart: axes, descending zig-zag, red down arrow.
function drawChart(cx: number, y: number): void {
  const x0 = cx - 110;
  const x1 = cx + 110;
  const yTop = y + 6;
  const yBot = y + 88;
  drawLine(x0, yBot, x1, yBot, INK, 3);
  drawLine(x0, yTop, x0, yBot, INK, 3);
  const pts: [number, number][] = [
    [x0 + 8, yTop + 12],
    [x0 + 52, yTop + 26],
    [x0 + 88, yTop + 20],
    [x0 + 128, yTop + 48],
    [x0 + 168, yTop + 58],
    [x0 + 204, yTop + 76],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 5);
  }
  for (const [px, py] of pts) fillCircle(px, py, 4, RED);
  // down arrow at the end of the fall
  const ax = x0 + 204;
  const ay = yTop + 76;
  fillTriangle(ax - 12, ay - 4, ax + 12, ay - 4, ax, ay + 18, RED);
  fillRect(ax - 4, ay - 16, 8, 14, RED);
  drawText(cx + 34, y + 8, "-4.4%", 2, RED);
}

// 2. Rocket to the station: vertical body, nose cone, fins, flame,
//    stars and a ringed planet.
function drawRocket(cx: number, y: number): void {
  // stars
  const stars: [number, number][] = [
    [cx - 108, y + 12],
    [cx - 84, y + 52],
    [cx + 96, y + 8],
    [cx + 108, y + 58],
    [cx - 96, y + 78],
    [cx + 80, y + 80],
  ];
  for (const [sx, sy] of stars) {
    fillRect(sx - 1, sy - 4, 2, 8, GOLD);
    fillRect(sx - 4, sy - 1, 8, 2, GOLD);
  }
  // ringed planet, lower left
  fillCircle(cx - 88, y + 66, 14, NAVY2);
  drawLine(cx - 104, y + 74, cx - 72, y + 58, GOLD, 3);
  // fins
  fillTriangle(cx - 12, y + 46, cx - 28, y + 66, cx - 10, y + 62, RED);
  fillTriangle(cx + 12, y + 46, cx + 28, y + 66, cx + 10, y + 62, RED);
  // body
  fillRect(cx - 11, y + 12, 22, 54, WHITE);
  fillRect(cx - 11, y + 12, 2, 54, NAVY);
  fillRect(cx + 9, y + 12, 2, 54, NAVY);
  fillRect(cx - 11, y + 64, 22, 2, NAVY);
  // nose cone
  fillTriangle(cx - 11, y + 12, cx + 11, y + 12, cx, y - 8, RED);
  // window
  fillCircle(cx, y + 32, 5, GOLD);
  fillCircle(cx, y + 32, 3, NAVY2);
  // flame
  fillTriangle(cx - 7, y + 66, cx + 7, y + 66, cx, y + 90, ORANGE);
  fillTriangle(cx - 3, y + 66, cx + 3, y + 66, cx, y + 80, GOLD);
}

// 3. Thanksgiving pumpkin with autumn leaves.
function drawPumpkin(cx: number, y: number): void {
  // falling leaves
  const leaves: [number, number, RGB][] = [
    [cx - 104, y + 14, GREEN],
    [cx + 100, y + 22, ORANGE],
    [cx - 96, y + 66, ORANGE],
    [cx + 104, y + 70, GREEN],
  ];
  for (const [lx, ly, lc] of leaves) {
    fillTriangle(lx, ly - 6, lx + 8, ly, lx, ly + 6, lc);
    fillTriangle(lx, ly - 6, lx - 8, ly, lx, ly + 6, lc);
  }
  // pumpkin body
  fillEllipse(cx, y + 52, 62, 40, ORANGE);
  fillEllipse(cx, y + 52, 44, 40, [211, 132, 20]);
  fillEllipse(cx, y + 52, 22, 40, ORANGE);
  // ribs
  drawLine(cx - 30, y + 18, cx - 34, y + 86, [150, 90, 10], 2);
  drawLine(cx + 30, y + 18, cx + 34, y + 86, [150, 90, 10], 2);
  drawLine(cx, y + 12, cx, y + 92, [150, 90, 10], 2);
  // stem + leaf
  fillRect(cx - 4, y + 2, 8, 16, GREEN);
  fillTriangle(cx + 4, y + 10, cx + 26, y + 2, cx + 22, y + 16, GREEN);
  // face: two eyes + smile
  fillTriangle(cx - 26, y + 40, cx - 14, y + 40, cx - 20, y + 50, INK);
  fillTriangle(cx + 14, y + 40, cx + 26, y + 40, cx + 20, y + 50, INK);
  drawLine(cx - 18, y + 62, cx + 18, y + 62, INK, 3);
}

// ---- layout ----
function drawMasthead(): void {
  fillRect(0, 0, W, 140, NAVY);
  drawTextCenter(0, 16, W, "THE WORLD TODAY", 6, WHITE);
  drawTextCenter(0, 64, W, "THURSDAY 26 NOVEMBER 2026", 5, GOLD);
  drawTextCenter(0, 112, W, "THE DAY'S NEWS, FROM EVERY REGION, REPORTED 26 NOVEMBER 2026", 2, WHITE);
  fillRect(0, 140, W, 4, GOLD);
}

interface Lead {
  label: string;
  labelColor: RGB;
  headline: string[];
  deck: string;
  picto: (cx: number, y: number) => void;
}

const LEADS: Lead[] = [
  {
    label: "TRADE",
    labelColor: RED,
    headline: ["TRUMP TARIFFS", "ROCK MARKETS"],
    deck: "CHINA FACES 20% DUTY; NASDAQ SINKS 4.4%, DOW -1,039",
    picto: drawChart,
  },
  {
    label: "SPACE",
    labelColor: NAVY2,
    headline: ["SHENZHOU-24", "REACHES ORBIT"],
    deck: "FIRST PAKISTANI IN ORBIT ABOARD CHINA'S STATION",
    picto: drawRocket,
  },
  {
    label: "HOLIDAY",
    labelColor: ORANGE,
    headline: ["THANKSGIVING", "DAY IN AMERICA"],
    deck: "EAST COAST STORM BRINGS RAIN AND HIGH WINDS FOR THE HOLIDAY",
    picto: drawPumpkin,
  },
];

function drawLeads(): void {
  const y0 = 152;
  const h = 250;
  const w = 322;
  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    const x = 16 + i * (w + 12);
    fillRect(x, y0, w, h, WHITE);
    // border
    fillRect(x, y0, w, 2, NAVY);
    fillRect(x, y0 + h - 2, w, 2, NAVY);
    fillRect(x, y0, 2, h, NAVY);
    fillRect(x + w - 2, y0, 2, h, NAVY);
    // label band
    fillRect(x + 2, y0 + 2, w - 4, 24, lead.labelColor);
    drawTextCenter(x, y0 + 6, w, lead.label, 2, WHITE);
    // pictogram
    lead.picto(x + Math.floor(w / 2), y0 + 34);
    // headline, two lines, scale 3
    drawTextCenter(x, y0 + 128, w, lead.headline[0], 3, NAVY);
    drawTextCenter(x, y0 + 152, w, lead.headline[1], 3, NAVY);
    // deck, scale 2, wrapped
    drawWrapped(x + 16, y0 + 182, lead.deck, w - 32, 2, 17, INK, 3);
  }
}

interface Region {
  name: string;
  color: RGB;
  items: string[];
}

const REGIONS: Region[] = [
  {
    name: "EUROPE",
    color: NAVY2,
    items: [
      "EU PLANS 50BN EURO TECH FUND",
      "EUROSTAR AXES TRAINS IN STRIKE",
      "EASYJET PROFIT SLUMPS 90%",
      "CANARIES SEE RECORD MIGRANT DAY",
    ],
  },
  {
    name: "MIDDLE EAST",
    color: [122, 59, 18],
    items: [
      "ISRAELI STRIKE KILLS HAMAS OFFICIAL",
      "IRAN SAYS IT CAN WITHSTAND BLOCKADE",
      "IRAQ COURT BACKS TROOPS AT BORDER",
    ],
  },
  {
    name: "NORTH AMERICA",
    color: GREEN,
    items: [
      "US CONSUMER CONFIDENCE NEAR 2-YR HIGH",
      "CANADA'S CARNEY UNVEILS STEEL AID",
      "MICROSOFT CODE RED AFTER OUTAGE",
    ],
  },
  {
    name: "ASIA-PACIFIC",
    color: [108, 52, 131],
    items: [
      "BANGLADESH RAISES GARMENT WAGE 36%",
      "N. KOREA ORDERS SWISS OFFICE SHUT",
      "HASINA SEEKS RETURN TO DHAKA DEC 16",
      "S. KOREA BANK SET TO RAISE RATES",
      "AUSTRALIA-SOLOMONS SECURITY PACT",
      "INDIA MARKS CONSTITUTION DAY",
    ],
  },
  {
    name: "AFRICA",
    color: [125, 102, 8],
    items: [
      "SAHEL INSURGENTS FLY ATTACK DRONES",
      "ETHIOPIA PUSHES HEALTH INDEPENDENCE",
      "EGYPT HAILS SUEZ CANAL RECOVERY",
    ],
  },
  {
    name: "LATIN AMERICA",
    color: [14, 102, 85],
    items: [
      "COLOMBIA MARKS 10 YEARS OF PEACE DEAL",
      "PETROBRAS UNVEILS 122BN DOLLAR PLAN",
      "VENEZUELA REVEALS 237.5BN DOLLAR DEBT",
    ],
  },
];

function drawRegions(): void {
  const w = 490;
  const h = 152;
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 16 + col * (w + 12);
    const y = 414 + row * (h + 10);
    fillRect(x, y, w, h, WHITE);
    fillRect(x, y, w, 2, NAVY);
    fillRect(x, y + h - 2, w, 2, NAVY);
    fillRect(x, y, 2, h, NAVY);
    fillRect(x + w - 2, y, 2, h, NAVY);
    // title band
    fillRect(x + 2, y + 2, w - 4, 28, r.color);
    drawText(x + 12, y + 9, r.name, 2, WHITE);
    // bullet lines
    let ly = y + 40;
    for (const item of r.items) {
      const lines = wrapText(item, w - 40, 2);
      for (const line of lines) {
        fillRect(x + 12, ly + 4, 6, 6, r.color);
        drawText(x + 26, ly, line, 2, INK);
        ly += 17;
      }
    }
  }
}

function drawStrip(): void {
  const y0 = 898;
  fillRect(16, y0, 992, 70, WHITE);
  fillRect(16, y0, 992, 2, NAVY);
  fillRect(16, y0 + 68, 992, 2, NAVY);
  fillRect(16, y0, 2, 70, NAVY);
  fillRect(1006, y0, 2, 70, NAVY);
  drawText(28, y0 + 6, "ALSO TODAY: TECH, SCIENCE AND SPORT", 2, NAVY);
  fillRect(16, y0 + 26, 992, 2, GOLD);
  const items: [string, string][] = [
    ["BEPICOLOMBO REACHES MERCURY ORBIT", "IPL 2027 AUCTION DRAWS 1,220 PLAYERS"],
    ["GUKESH FACES SINDAROV IN CHESS FINAL", "SOORYAVANSHI SMASHES 204 OFF 53 BALLS"],
  ];
  for (let row = 0; row < 2; row++) {
    const y = y0 + 34 + row * 18;
    fillRect(28, y + 4, 6, 6, NAVY);
    drawText(42, y, items[row][0], 2, INK);
    fillRect(524, y + 4, 6, 6, NAVY);
    drawText(538, y, items[row][1], 2, INK);
  }
}

function drawFooter(): void {
  fillRect(0, 974, W, 50, NAVY);
  drawTextCenter(0, 984, W, "SOURCES: REUTERS, XINHUA, ESA, CBC, JAGRANJOSH, LIBRE NEWS", 2, WHITE);
  drawTextCenter(0, 1004, W, "ALL STORIES FIRST REPORTED 26 NOVEMBER 2026", 2, GOLD);
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLeads();
  drawRegions();
  drawStrip();
  drawFooter();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
