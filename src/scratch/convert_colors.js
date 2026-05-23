// Helper script to convert HEX colors to OKLCH coordinates precisely.

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToOklch({ r: r_val, g: g_val, b: b_val }) {
  // 1. Normalize sRGB to [0, 1]
  let r_s = r_val / 255;
  let g_s = g_val / 255;
  let b_s = b_val / 255;

  // 2. Convert to linear sRGB
  const toLinear = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r_l = toLinear(r_s);
  const g_l = toLinear(g_s);
  const b_l = toLinear(b_s);

  // 3. Transform to LMS
  const l = 0.4122214708 * r_l + 0.5363325363 * g_l + 0.0514459929 * b_l;
  const m = 0.2119034982 * r_l + 0.6806995451 * g_l + 0.1073969566 * b_l;
  const s = 0.0883024619 * r_l + 0.2817188376 * g_l + 0.6299787005 * b_l;

  // 4. Non-linear LMS
  const l_ = Math.pow(Math.max(0, l), 1/3);
  const m_ = Math.pow(Math.max(0, m), 1/3);
  const s_ = Math.pow(Math.max(0, s), 1/3);

  // 5. Transform to Oklab (L, a, b)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // 6. Convert to OKLCH
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    L: L.toFixed(3),
    C: C.toFixed(3),
    h: h.toFixed(1)
  };
}

const colors = {
  "background-gradient-start": "#a0c4ff",
  "background-gradient-mid": "#d8e5ff",
  "background-gradient-end": "#ffffff",
  "primary": "#3059b9",
  "secondary": "#3d5f91",
  "surface": "#f7f9fe",
  "surface-dim": "#d8dadf",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f1f4f9",
  "surface-container": "#eceef3",
  "surface-container-high": "#e6e8ed",
  "surface-container-highest": "#e0e2e7",
  "on-surface": "#181c20",
  "on-surface-variant": "#434652",
  "outline": "#747684",
  "outline-variant": "#c4c6d4",
  "primary-container": "#769bff",
  "on-primary-container": "#003080",
  "inverse-primary": "#b3c5ff"
};

console.log("### PRECESS OKLCH COLOR MAP ###\n");
for (const [name, hex] of Object.entries(colors)) {
  const rgb = hexToRgb(hex);
  const oklch = rgbToOklch(rgb);
  console.log(`--${name}: oklch(${oklch.L} ${oklch.C} ${oklch.h}); /* ${hex} */`);
}
