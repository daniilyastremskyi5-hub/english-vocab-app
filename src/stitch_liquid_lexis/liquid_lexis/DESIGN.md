---
name: Liquid Lexis
colors:
  surface: '#f7f9fe'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ed'
  surface-container-highest: '#e0e2e7'
  on-surface: '#181c20'
  on-surface-variant: '#434652'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eff1f6'
  outline: '#747684'
  outline-variant: '#c4c6d4'
  surface-tint: '#3059b9'
  primary: '#3059b9'
  on-primary: '#ffffff'
  primary-container: '#769bff'
  on-primary-container: '#003080'
  inverse-primary: '#b3c5ff'
  secondary: '#3d5f91'
  on-secondary: '#ffffff'
  secondary-container: '#a3c5fd'
  on-secondary-container: '#2e5182'
  tertiary: '#7a5900'
  on-tertiary: '#ffffff'
  tertiary-container: '#cb9600'
  on-tertiary-container: '#473200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#0940a0'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#a7c8ff'
  on-secondary-fixed: '#001c3b'
  on-secondary-fixed-variant: '#224777'
  tertiary-fixed: '#ffdea2'
  tertiary-fixed-dim: '#f8bd37'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5c4200'
  background: '#f7f9fe'
  on-background: '#181c20'
  surface-variant: '#e0e2e7'
typography:
  display:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 24px
  element-gap: 16px
  floating-margin: 32px
  stack-space: 12px
---

## Brand & Style

The design system is centered on the concept of "Liquid Glass"—an aesthetic that prioritizes ethereal transparency, depth, and serenity. Designed for a focused English word analysis experience, the UI avoids heavy containers and traditional structural anchors like navigation bars or headers. 

The emotional response is one of intellectual calm and weightlessness. By leveraging **Glassmorphism** and **Minimalism**, the interface feels like a series of light-refracting lenses floating over a soft atmospheric gradient. There is no visual "noise"; every element exists to facilitate deep linguistic focus through soft textures and subtle motion.

## Colors

The palette is monochromatic and high-key, utilizing varying shades of white and light blue to simulate light passing through water and glass. 

- **Primary & Secondary:** Used sparingly for interactive highlights or subtle text emphasis.
- **Background:** A permanent soft white-to-blue gradient that provides the "atmosphere" for floating elements.
- **Glass Fill:** The core surface color is a semi-transparent white. This should always be paired with a `backdrop-filter: blur(20px)` to achieve the liquid glass effect.
- **Glass Stroke:** A highly translucent white border used to define the edges of floating objects, simulating the refractive rim of a glass lens.

## Typography

This design system eschews bold weights entirely to maintain a "light-as-air" feeling. Clarity is achieved through size, tracking, and color contrast rather than thickness. 

**Manrope** is used for its modern, geometric-yet-humanist construction which complements the rounded UI. All text should be treated with high legibility in mind, using slightly increased line height to allow the background gradient to "breathe" through the characters. Headlines should never exceed a weight of 400 (Regular) to prevent them from feeling "heavy" against the transparent glass backgrounds.

## Layout & Spacing

The layout philosophy is "No-Grid / Floating." Without headers or nav-bars, the content is vertically centered or arranged in a free-floating stack. 

- **Floating Hierarchy:** Elements should appear to hover at different "altitudes," separated by generous vertical spacing (`stack-space`).
- **Safe Zones:** High `floating-margin` values ensure content never touches the screen edges, reinforcing the "object in space" metaphor.
- **Reflow:** On larger devices, glass cards should not stretch to the full width but rather maintain an elegant, readable max-width (approx. 400px) to preserve the minimalist aesthetic.

## Elevation & Depth

Depth is the primary communicator of hierarchy in this design system. It is achieved through three layers:

1.  **Backdrop Blur:** A heavy Gaussian blur (20px - 40px) applied to the surface behind glass elements.
2.  **Inner Glow / Rim Light:** A 1px solid white border (`glass_stroke`) with low opacity to catch the "light" at the edges of the card.
3.  **Ambient Shadow:** Very soft, large-radius shadows with low opacity (e.g., `0px 20px 40px rgba(0, 0, 0, 0.04)`). The shadow should be tinted with the background blue rather than pure black to maintain the "liquid" feel.

## Shapes

The shape language is organic and soft. 

- **Input Fields & Cards:** Use Level 2 roundedness (0.5rem base) to ensure they feel approachable and smooth.
- **Buttons:** All primary action buttons must be **perfectly circular**. This differentiates them from informational cards and reinforces the minimalist, tool-like nature of the app.
- **Selections:** Active states in lists should use pill-shaped highlights or soft-glow circular indicators.

## Components

### Glass Cards
The primary container for word analysis data. They feature a semi-transparent white fill and a 1px "rim light" border. Content inside should have ample padding (24px) to avoid crowding the edges.

### Circular Buttons
Actionable icons (like "Search", "Listen", or "Save") are housed in circular glass containers. They should use subtle inner shadows to appear slightly concave, inviting a "press."

### Minimalist Inputs
Search or word entry fields are transparent with only a soft bottom border or a very faint glass fill. The focus state is indicated by a subtle increase in the backdrop blur or a soft outer glow—never a heavy border.

### Word Analysis Lists
Lists of definitions or synonyms are presented as "floating chips" or simple text blocks separated by wide gaps. Avoid dividers; use spatial grouping to indicate relationships.

### Refractive Chips
Small indicators for word types (e.g., *noun*, *verb*) use a higher-opacity glass fill with a slight blue tint to distinguish them from the main content.