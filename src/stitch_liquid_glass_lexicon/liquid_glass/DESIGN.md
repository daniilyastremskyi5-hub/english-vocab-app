---
name: Liquid Glass
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#44474b'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#74777b'
  outline-variant: '#c4c6cb'
  surface-tint: '#565f6a'
  primary: '#565f6a'
  on-primary: '#ffffff'
  primary-container: '#d6e0ec'
  on-primary-container: '#59636d'
  inverse-primary: '#bdc8d3'
  secondary: '#5a5f63'
  on-secondary: '#ffffff'
  secondary-container: '#dce0e5'
  on-secondary-container: '#5e6367'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#dfdfdf'
  on-tertiary-container: '#616263'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae3f0'
  primary-fixed-dim: '#bdc8d3'
  on-primary-fixed: '#131d25'
  on-primary-fixed-variant: '#3e4851'
  secondary-fixed: '#dfe3e8'
  secondary-fixed-dim: '#c3c7cc'
  on-secondary-fixed: '#171c20'
  on-secondary-fixed-variant: '#42474b'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  gutter: 16px
  element-gap: 12px
  section-margin: 32px
---

## Brand & Style

This design system embodies a forward-looking "iOS Liquid Glass" aesthetic, projecting a mood of "ice and light." The brand personality is ethereal, calm, and hyper-refined, targeting a user base that appreciates premium, high-fidelity interfaces. 

The visual style is a rigorous evolution of **Glassmorphism**. It relies on high-translucency layers, heavy backdrop blurs, and "cold" tonal shifts to create a sense of depth without weight. The interface does not compete with the background; rather, it sits suspended within it, using light refraction and subtle shadows to maintain legibility. The emotional response is one of clarity, breathability, and quiet sophistication.

## Colors

The palette is monochromatic and "cold," inspired by glacial environments and pearl finishes. 

- **Background:** A static gradient transitioning from a cold blue-grey (#D6E0EC) to a pale mist (#EEF2F7). 
- **Surface:** Surfaces are not opaque. They utilize a highly transparent white (35% opacity) that allows the 3D ribbons of the background to bleed through softly.
- **Accents:** There are no vibrant accent colors. Interactivity is signaled through shifts in luminosity, depth (shadow intensity), and blurred refraction rather than hue changes.
- **Typography:** Deep charcoal (#1C1C1E) is used for primary headers to ensure accessibility against the light glass, while a mid-tone grey (#6E6E73) handles secondary information.

## Typography

This design system utilizes **Hanken Grotesk** for its precise, contemporary geometry that aligns with the "Liquid Glass" theme. 

The type scale emphasizes a generous vertical rhythm and subtle negative letter-spacing on larger headings to maintain a compact, premium feel. 
- **Hierarchy:** Headlines use semi-bold weights to anchor the floating glass containers. 
- **Legibility:** Since text sits on semi-transparent surfaces, avoid thin weights (below 400) for body text to ensure optical clarity against the background blur.
- **Micro-copy:** Labels use slightly increased letter spacing and medium weights to ensure high "glanceability" in functional UI areas.

## Layout & Spacing

The layout philosophy is based on a **Fluid Grid** with wide margins to emphasize the "Airy" brand personality. 

- **Grid:** Use a 12-column grid for desktop and a 4-column grid for mobile. 
- **Negative Space:** Content should feel uncrowded. Use generous padding inside glass containers (minimum 24px) to prevent text from nearing the rounded edges.
- **Floatation:** Elements should never touch the edges of the viewport. They must appear as islands floating over the static 3D background.
- **Breakpoints:** 
    - Mobile: < 600px (Margins: 20px)
    - Tablet: 600px - 1024px (Margins: 32px)
    - Desktop: > 1024px (Margins: Auto-centered max-width of 1200px)

## Elevation & Depth

Depth is the primary communicator of hierarchy in this design system. It is achieved through a combination of light refraction and soft shadows.

- **The Glass Layer:** Every interactive surface must use a `20px` backdrop-filter blur. This simulates high-density frosted glass.
- **The Edge:** A `1px` solid white border at 60% opacity acts as a "specular highlight," defining the edge of the glass where light would naturally catch.
- **Shadows:** Use a very diffused, low-intensity shadow (`0 4px 24px rgba(0, 0, 0, 0.06)`). The shadow should feel like ambient occlusion rather than a direct light source projection.
- **Stacking:** When layering glass on glass, the blur radius should be additive or the top-most layer should increase in brightness (e.g., 45% white opacity) to maintain separation.

## Shapes

The shape language is defined by **large, continuous radii**. 

All primary containers (cards, modals) use a **20px (1.25rem)** corner radius. Smaller elements like buttons and input fields should follow this proportion, maintaining a "Soft" to "Rounded" appearance. 

Avoid sharp 0px corners entirely, as they break the liquid, organic metaphor of the brand. For components like tags or selection chips, use fully pill-shaped (rounded-full) geometry to differentiate them from structural containers.

## Components

### Buttons
- **Primary:** A glass surface with a slightly higher white opacity (50%) and a subtle inner glow. Text is Bold #1C1C1E.
- **Secondary:** Ghost style with only the 1px white border and no background fill until hover.

### Cards
- Use the standard glass formula (35% white, 20px blur, 1px border). 
- Inner content should be padded by at least 24px.

### Input Fields
- Background uses a slightly darker glass or a subtle inset shadow to indicate "recessed" interactivity. 
- Placeholder text: #6E6E73 at 60% opacity.
- Focus state: The 1px border increases to 1.5px and 100% white opacity.

### Chips & Tags
- Fully rounded (pill) shapes.
- Use a "Pearlescent" fill: `rgba(255, 255, 255, 0.2)` with a very fine 0.5px border.

### Selection Controls
- **Checkboxes/Radios:** Use the dark grey (#1C1C1E) for the "active" mark, but keep the container glass-based. 
- **Switches:** The "track" is blurred glass; the "thumb" is a solid, high-gloss white circle that appears to sit on top of the glass.

### Segmented Control
- A single glass container where the "selected" state is a smaller glass card that slides behind the text labels, creating a double-layered glass effect.