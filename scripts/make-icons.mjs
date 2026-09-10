// 依存なしで PWA 用アイコン PNG を生成する（炎をイメージした簡易グラデーション）
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size * 0.58;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const dx = (x - cx) / size, dy = (y - cy) / size;
      // 炎のしずく型: 上に伸びる楕円
      const r = Math.sqrt(dx * dx * 1.6 + (dy + 0.08) * (dy + 0.08) * (dy < 0 ? 0.55 : 1.4));
      let R = 26, G = 11, B = 20;
      if (r < 0.36) {
        const t = r / 0.36;
        R = Math.round(255 - t * 40); G = Math.round(230 - t * 180); B = Math.round(120 - t * 100);
        if (r < 0.14) { R = 255; G = 245; B = 200; }
      }
      // 角丸背景
      const ex = Math.abs(x - size / 2) / (size / 2), ey = Math.abs(y - size / 2) / (size / 2);
      const corner = Math.max(0, ex - 0.78) ** 2 + Math.max(0, ey - 0.78) ** 2;
      const alpha = corner > 0.22 * 0.22 ? 0 : 255;
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const s of [192, 512]) writeFileSync(`public/icon-${s}.png`, png(s));
console.log('icons written');
