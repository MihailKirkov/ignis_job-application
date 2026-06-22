import { ImageResponse } from 'next/og';

// Shared HUD social card (1200×630), used by both app/opengraph-image.tsx and
// app/twitter-image.tsx. Renders entirely on-brand: dark base, faint cyan grid,
// the reticle mark, the product name + tagline. No static placeholder art.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';
export const OG_ALT = 'Job Command Center — AI-scored job discovery';

const BG = '#060A12';
const CYAN = '#22D3EE';
const FG = '#E8F1F8';
const MUTED = '#7C8DA6';

// Full-canvas background: dark fill + tiled faint cyan grid (matches the app's
// body grid). Drawn in one SVG so resvg handles the tiling, not satori CSS.
const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <defs>
    <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 H0 V40" fill="none" stroke="${CYAN}" stroke-width="1" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;

// The reticle mark (same language as app/icon.svg), sized for the card.
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 32 32" fill="none">
  <path d="M6 2 H30 V26 L26 30 H2 V6 Z" fill="${BG}"/>
  <path d="M6 2 H30 V26 L26 30 H2 V6 Z" fill="none" stroke="${CYAN}" stroke-width="2" stroke-linejoin="miter"/>
  <g stroke="${CYAN}" stroke-width="2" stroke-linecap="round">
    <path d="M16 7 V13"/><path d="M16 19 V25"/><path d="M7 16 H13"/><path d="M19 16 H25"/>
  </g>
  <circle cx="16" cy="16" r="1.7" fill="${CYAN}"/>
</svg>`;

const dataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: BG,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri(gridSvg)}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '88px',
            gap: '28px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri(markSvg)} width={132} height={132} alt="" />
          <div
            style={{
              display: 'flex',
              fontSize: 80,
              fontWeight: 700,
              color: FG,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Job Command Center
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: CYAN,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            AI-scored job discovery
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: '8px',
              fontSize: 24,
              color: MUTED,
            }}
          >
            Ingest · score · track — best-fit-first.
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
