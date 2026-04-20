import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

// Brand colors. Blue matches the main site logo (sampled from uwc-bay-area-logo.png).
// Orange is the suggested brand vermilion from the favicon option.
const BLUE = "#3E639A";
const ORANGE = "#D24726";

// ---------------------------------------------------------------------------
// Bridge SVG — designed to stay readable at 16x16.
// Two towers, cables sweeping down-up-down across the span, a flat roadbed.
// Thick strokes with rounded caps so it doesn't fall apart on rasterization.
// ---------------------------------------------------------------------------

function bridgeIconSvg({ withText = false, size = 180 } = {}) {
  // Coordinate system: viewBox 24x24. Icon takes roughly 20x14 centered.
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <g fill="none" stroke="${ORANGE}" stroke-linecap="round" stroke-linejoin="round">
        <!-- Roadbed -->
        <line x1="2"   y1="17.5" x2="22"  y2="17.5" stroke-width="2"/>
        <!-- Towers -->
        <line x1="7.25" y1="4"   x2="7.25" y2="17.5" stroke-width="2.5"/>
        <line x1="16.75" y1="4"   x2="16.75" y2="17.5" stroke-width="2.5"/>
        <!-- Tower caps -->
        <line x1="6.25" y1="4.25" x2="8.25" y2="4.25" stroke-width="1"/>
        <line x1="15.75" y1="4.25" x2="17.75" y2="4.25" stroke-width="1"/>
        <!-- Left cable — outer tower down to roadbed -->
        <path d="M2 17 Q3.5 9 7.25 4.5" stroke-width="2"/>
        <!-- Center cable — dip between towers -->
        <path d="M7.25 4.5 Q12 13 16.75 4.5" stroke-width="2"/>
        <!-- Right cable — tower down to roadbed -->
        <path d="M16.75 4.5 Q20.5 9 22 17" stroke-width="2"/>
      </g>
    </svg>
  `;

  if (!withText) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${BLUE}"/>
      <svg x="15" y="18" width="70" height="70" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
        <g fill="none" stroke="${ORANGE}" stroke-linecap="round" stroke-linejoin="round">
          <line x1="2"   y1="17.5" x2="22"  y2="17.5" stroke-width="2.2"/>
          <line x1="7.25" y1="4"   x2="7.25" y2="17.5" stroke-width="2.6"/>
          <line x1="16.75" y1="4"   x2="16.75" y2="17.5" stroke-width="2.6"/>
          <line x1="6.25" y1="4.25" x2="8.25" y2="4.25" stroke-width="1"/>
          <line x1="15.75" y1="4.25" x2="17.75" y2="4.25" stroke-width="1"/>
          <path d="M2 17 Q3.5 9 7.25 4.5" stroke-width="2"/>
          <path d="M7.25 4.5 Q12 13 16.75 4.5" stroke-width="2"/>
          <path d="M16.75 4.5 Q20.5 9 22 17" stroke-width="2"/>
        </g>
      </svg>
    </svg>`;
  }

  // 180x180 variant with 'Bay Area' text below the bridge.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${BLUE}"/>
    <svg x="18" y="12" width="64" height="64" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
      <g fill="none" stroke="${ORANGE}" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2"   y1="17.5" x2="22"  y2="17.5" stroke-width="2.2"/>
        <line x1="7.25" y1="4"   x2="7.25" y2="17.5" stroke-width="2.6"/>
        <line x1="16.75" y1="4"   x2="16.75" y2="17.5" stroke-width="2.6"/>
        <line x1="6.25" y1="4.25" x2="8.25" y2="4.25" stroke-width="1"/>
        <line x1="15.75" y1="4.25" x2="17.75" y2="4.25" stroke-width="1"/>
        <path d="M2 17 Q3.5 9 7.25 4.5" stroke-width="2"/>
        <path d="M7.25 4.5 Q12 13 16.75 4.5" stroke-width="2"/>
        <path d="M16.75 4.5 Q20.5 9 22 17" stroke-width="2"/>
      </g>
    </svg>
    <text x="50" y="88"
          text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
          font-size="13"
          font-weight="700"
          fill="#FFFFFF"
          letter-spacing="0.5">Bay Area</text>
  </svg>`;
}

async function main() {
  const sizes = [
    { name: "favicon-16x16.png", size: 16, withText: false },
    { name: "favicon-32x32.png", size: 32, withText: false },
    { name: "apple-touch-icon.png", size: 180, withText: true },
  ];

  // Keep a 512px version for the webmanifest (no text, same as small favicons).
  sizes.push({ name: "android-chrome-512x512.png", size: 512, withText: false });

  for (const { name, size, withText } of sizes) {
    const svg = bridgeIconSvg({ withText, size });
    const outPath = join(publicDir, name);
    await sharp(Buffer.from(svg))
      .resize(size, size, { fit: "contain" })
      .png()
      .toFile(outPath);
    console.log(`wrote ${name} (${size}x${size})`);
  }

  // favicon.ico (32x32 only per user spec).
  const pngBuffer = await sharp(Buffer.from(bridgeIconSvg({ size: 32 })))
    .resize(32, 32, { fit: "contain" })
    .png()
    .toBuffer();
  const icoBuffer = await pngToIco([pngBuffer]);
  writeFileSync(join(publicDir, "favicon.ico"), icoBuffer);
  console.log("wrote favicon.ico (32x32)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
