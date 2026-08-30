/**
 * Генерация иконок приложения: `npm run icons`
 *
 * Рисуем сами, без внешних генераторов и зависимостей — знак простой
 * (две смещённые карточки на фоне цвета акцента), а PNG собирается через zlib.
 * Сглаживание — суперсэмплингом ×4.
 */
import { deflateSync, crc32 as zlibCrc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SS = 4; // кратность суперсэмплинга

const BRAND = [0x25, 0x63, 0xeb];
const PAPER = [0xff, 0xff, 0xff];

/** Точка внутри прямоугольника со скруглёнными углами. */
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function blend(dst, i, color, alpha) {
  for (let c = 0; c < 3; c++) {
    dst[i + c] = Math.round(dst[i + c] * (1 - alpha) + color[c] * alpha);
  }
  dst[i + 3] = 255;
}

/**
 * @param {number} size сторона в пикселях
 * @param {number} inset доля поля вокруг знака: 0 — во всю площадь,
 *                      0.1 — безопасная зона для maskable-иконки Android
 */
function drawIcon(size, inset = 0) {
  const pixels = new Uint8Array(size * size * 4);

  // фон — сплошной, иначе на тёмной теме системы иконка «поплывёт»
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = BRAND[0];
    pixels[i + 1] = BRAND[1];
    pixels[i + 2] = BRAND[2];
    pixels[i + 3] = 255;
  }

  // знак задан в долях стороны, потом ужимается под безопасную зону
  const k = 1 - inset * 2;
  const m = (v) => inset + v * k;

  const backCard = [m(0.3), m(0.18), m(0.84), m(0.7), m(0.06)];
  const frontCard = [m(0.16), m(0.3), m(0.7), m(0.82), m(0.06)];
  const lines = [
    [m(0.24), m(0.42), m(0.62), m(0.47), m(0.025)],
    [m(0.24), m(0.53), m(0.55), m(0.58), m(0.025)],
    [m(0.24), m(0.64), m(0.44), m(0.69), m(0.025)],
  ];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let backHits = 0;
      let frontHits = 0;
      let lineHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;

          if (inRoundedRect(x, y, ...backCard)) backHits++;
          if (inRoundedRect(x, y, ...frontCard)) frontHits++;
          for (const line of lines) if (inRoundedRect(x, y, ...line)) lineHits++;
        }
      }

      const total = SS * SS;
      const i = (py * size + px) * 4;
      // задняя карточка приглушена, передняя поверх неё, строчки — цветом фона
      if (backHits) blend(pixels, i, PAPER, (backHits / total) * 0.45);
      if (frontHits) blend(pixels, i, PAPER, frontHits / total);
      if (lineHits) blend(pixels, i, BRAND, Math.min(1, lineHits / total));
    }
  }

  return pixels;
}

const crc32 =
  typeof zlibCrc32 === "function"
    ? (buffer) => zlibCrc32(buffer)
    : (buffer) => {
        let crc = ~0;
        for (const byte of buffer) {
          crc ^= byte;
          for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
        return ~crc >>> 0;
      };

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  // строки без фильтрации: изображение из плоских заливок жмётся и так
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  ["public/icon-maskable-512.png", 512, 0.1],
  ["public/apple-touch-icon.png", 180, 0],
  ["app/icon.png", 192, 0],
];

for (const [path, size, inset] of targets) {
  mkdirSync(dirname(path), { recursive: true });
  const png = encodePng(size, drawIcon(size, inset));
  writeFileSync(path, png);
  console.log(`${path} — ${size}×${size}, ${Math.round(png.length / 1024)} КБ`);
}
