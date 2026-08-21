const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePNG(path, size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = pixels[i * 4];
      raw[o + 1] = pixels[i * 4 + 1];
      raw[o + 2] = pixels[i * 4 + 2];
      raw[o + 3] = pixels[i * 4 + 3];
    }
  }
  const idat = zlib.deflateSync(raw);
  fs.writeFileSync(path, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

function makeCanvas(size) {
  return { size: size, buf: new Uint8Array(size * size * 4) };
}
function setPx(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.buf[i] = r; c.buf[i + 1] = g; c.buf[i + 2] = b; c.buf[i + 3] = a;
}
function fillRect(c, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(c, x, y, color[0], color[1], color[2], color[3]);
}
function fillCircle(c, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPx(c, x, y, color[0], color[1], color[2], color[3]);
    }
  }
}

function drawOrders(size, color) {
  const c = makeCanvas(size);
  const [r, g, b] = color;
  const A = [r, g, b, 255];
  const bg = [0, 0, 0, 0];
  const x0 = 16, y0 = 14, x1 = 64, y1 = 66;
  fillRect(c, x0 + 4, y0, x1 - 4, y1, A);
  fillRect(c, x0, y0 + 4, x1, y1 - 4, A);
  fillRect(c, 28, 10, 52, 20, A);
  fillRect(c, 24, 26, 56, 27, bg);
  fillRect(c, 24, 38, 56, 39, bg);
  fillRect(c, 24, 50, 56, 51, bg);
  fillRect(c, 24, 56, 46, 57, bg);
  return c.buf;
}

function drawMe(size, color) {
  const c = makeCanvas(size);
  const [r, g, b] = color;
  const A = [r, g, b, 255];
  const cx = 40.5;
  fillCircle(c, cx, 27, 13, A);
  for (let y = 40; y <= 68; y++) {
    const t = (y - 44) / 24;
    const half = Math.sqrt(Math.max(0, 1 - t * t)) * 26;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) setPx(c, x, y, r, g, b, 255);
  }
  return c.buf;
}

const gray = [122, 126, 131];
const coffee = [166, 124, 82];
writePNG('images/orders.png', 81, drawOrders(81, gray));
writePNG('images/orders-active.png', 81, drawOrders(81, coffee));
writePNG('images/me.png', 81, drawMe(81, gray));
writePNG('images/me-active.png', 81, drawMe(81, coffee));
console.log('icons generated');
