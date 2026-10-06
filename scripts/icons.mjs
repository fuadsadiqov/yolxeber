/**
 * PWA ikonlarını loqodan (sarı romb, dizayn) yaradır → public/icons/.
 * İstifadə: node scripts/icons.mjs (nəticə repoya daxildir, yalnız loqo dəyişəndə lazımdır)
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// Loqo: ağ çərçivəli, tünd konturlu, 45° döndərilmiş sarı kvadrat
const logo = (size, { pad = 0.2, bg = "#16211C", radius = 0.22 } = {}) => {
  const s = size;
  const inner = s * (1 - pad * 2) * 0.62;
  const c = s / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * radius}" fill="${bg}"/>
  <g transform="rotate(45 ${c} ${c})">
    <rect x="${c - inner / 2 - s * 0.035}" y="${c - inner / 2 - s * 0.035}" width="${inner + s * 0.07}" height="${inner + s * 0.07}" rx="${s * 0.05}" fill="#FFFFFF"/>
    <rect x="${c - inner / 2}" y="${c - inner / 2}" width="${inner}" height="${inner}" rx="${s * 0.035}" fill="#F5B800"/>
  </g>
</svg>`);
};

await mkdir("public/icons", { recursive: true });
await sharp(logo(192)).png().toFile("public/icons/icon-192.png");
await sharp(logo(512)).png().toFile("public/icons/icon-512.png");
// maskable: kənarlar kəsilə bilər — daha çox boşluq, künc radiusu yoxdur
await sharp(logo(512, { pad: 0.3, radius: 0 })).png().toFile("public/icons/maskable-512.png");
await sharp(logo(180, { radius: 0 })).png().toFile("public/icons/apple-touch-icon.png");
await sharp(logo(64)).png().toFile("public/icons/favicon-64.png");
console.log("✓ ikonlar yaradıldı");
