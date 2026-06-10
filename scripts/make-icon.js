// Genera assets/icon-180.png e icon-512.png con Bucle sobre fondo oscuro.
// PNG codificado a mano (zlib built-in), sin dependencias.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Grilla de Bucle (copiada de js/sprites.js)
const PAL = { h:'#3a3a42', H:'#52525e', s:'#d8a878', S:'#b8895e', k:'#ff4040',
  J:'#27418f', j:'#3a57ad', t:'#3fa84f', T:'#5ac86a', o:'#9a5c28', W:'#e8e3d0',
  m:'#a8704a', D:'#202830', B:'#1a1a1a' };
const GRID = [
  '........hhhhhhhh........',
  '......hhhhhhhhhhhh......',
  '.....hhHHhhhhhhhhhh.....',
  '.....hhHHhhhhhhhhhh.....',
  '.....hhhhhhhhhhhhhh.....',
  '......ssssssssssss......',
  '......ssssssssssss......',
  '......skk.ssss.kks......',
  '......skk.ssss.kks......',
  '......ssssssssssss......',
  '.......ssssmmssss.......',
  '.......sSssssssSs.......',
  '.....JJJjjJJJJjjJJJ.....',
  '....JJJJJJJJJJJJJJJJ....',
  '...sJJJJtt.ttJJJJJJJs...',
  '..oooJJJttttttJJJJJJss..',
  '.oooooJJtTttttJJJJJJ.s..',
  '.ooWooJJJ.tt.JJJJJJJ....',
  '.ooWooJJJJttJJJJJJJJ....',
  '.oooooJJJJJJJJJJJJJJ....',
  '..ooo..JJJJJJJJJJJ......',
  '........DDDDDDDDDD......',
  '........DDDDDDDDDD......',
  '........DDD..DDD........',
  '........sss..sss........',
  '........sss..sss........',
  '........Sss..Sss........',
  '.......BBBB..BBBB.......',
];

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// CRC32 para los chunks PNG
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function makePng(size) {
  // bitmap RGBA
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, r, g, b) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  // fondo + viñeta dorada sutil
  const [br, bg, bb] = hex('#16131c');
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - cx, y - cy) / (size * 0.7);
    const glow = Math.max(0, 1 - d) * 0.16;
    put(x, y,
      Math.round(br + (255 - br) * glow * 0.9),
      Math.round(bg + (216 - bg) * glow * 0.9),
      Math.round(bb + (79 - bb) * glow * 0.5));
  }
  // Bucle centrado, escala entera
  const gw = GRID[0].length, gh = GRID.length;
  const k = Math.floor(size * 0.84 / gh);
  const ox = Math.floor((size - gw * k) / 2), oy = Math.floor((size - gh * k) / 2);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const col = PAL[GRID[gy][gx]];
    if (!col) continue;
    const [r, g, b] = hex(col);
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++)
      put(ox + gx * k + dx, oy + gy * k + dy, r, g, b);
  }
  // scanlines con filtro 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'assets');
fs.writeFileSync(path.join(out, 'icon-180.png'), makePng(180));
fs.writeFileSync(path.join(out, 'icon-512.png'), makePng(512));
console.log('iconos generados en assets/');
