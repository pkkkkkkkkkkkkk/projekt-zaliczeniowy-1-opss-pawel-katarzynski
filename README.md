# ProZal - Static Showcase Website

Live demo: https://pkkkkkkkkkkkkk.github.io/projekt-zaliczeniowy-1-opss-pawel-katarzynski/

## Overview
This project is a single-page, static showcase website for a software team brand called **ProZal** (Projekt Zaliczeniowy).
It is built as a pure frontend site (no backend runtime, no build pipeline) and is ready for static hosting (currently using GitHub Pages).

The page combines:
- marketing content sections (`About`, `Portfolio`, `Services`, `Technologies`, `Contact`)
- custom motion effects
- interactive cards and UI microinteractions
- a layered animated hero background (WebGL + Canvas 2D)

## Technology Stack
Runtime technologies used directly in this project:

| Technology | Where used | Notes |
|---|---|---|
| HTML5 | `index.html` | Semantic page structure and section anchors |
| CSS3 | `css/style.css` | Design system, layout, effects, responsive rules |
| Vanilla JavaScript | `js/*.js` | UI logic and animation lifecycle |
| Three.js (r182, vendored) | `js/water-bg.js`, `js/vendor/three.*.min.js` | custom WebGL water shader in hero background that i used in some other of my projects |
| Canvas 2D API | `js/particles.js` | Particle field, connecting lines, glow blobs |
| Bootstrap 5.3.3 (CDN) | `index.html` | Grid, navbar, utility classes, collapse behavior |
| Bootstrap Icons 1.11.3 (CDN) | `index.html` | Section and UI icons |
| Google Fonts (Inter) | `index.html` | Typography |
| GitHub Pages compatible static hosting | `.nojekyll` | No Jekyll processing required |

## How It Works

### 1. Page and section structure
- `index.html` defines all visible sections and content.
- Navbar links point to section IDs and use Bootstrap ScrollSpy (`data-bs-spy="scroll"`).
- The hero area has three visual layers:
  - `#heroBg3d` for Three.js WebGL rendering
  - `#particleCanvas` for Canvas particle effects
  - `.hero-bg` for CSS gradients/overlays

### 2. Hero 3D water (`js/water-bg.js`)
- Loaded as an ES module (`type="module"`).
- Imports local Three.js module build from `js/vendor/three.module.min.js`.
- Builds a `THREE.Scene`, `PerspectiveCamera`, and `WebGLRenderer`.
- Uses a custom vertex + fragment shader (`ShaderMaterial`) to simulate animated water waves and highlights.
- Lifecycle/performance controls:
  - stops animation when page is hidden (`visibilitychange`)
  - stops animation when hero section is out of viewport (`IntersectionObserver`)
  - respects `prefers-reduced-motion`
  - caps pixel ratio (`DPR_CAP = 2`)
  - disposes geometry/material/renderer on unload

### 3. Hero particle field (`js/particles.js`)
- Renders particles on `#particleCanvas` using Canvas 2D.
- Uses multiple particle layers with different sizes/speeds/opacities.
- Draws optional connection lines per layer using a spatial grid lookup (faster neighbor search than naive all-to-all checks).
- Adds pointer interaction and soft radial glow blobs.
- Includes adaptive quality on mobile:
  - detects low FPS windows
  - reduces particle density gradually
  - restores quality when performance is stable
- Also pauses when hero is off-screen or page is hidden.

### 4. Section effects (`js/section-effects.js`)
- Reveals elements marked with `data-reveal` using `IntersectionObserver`.
- Applies stagger delays for grouped grids (`data-stagger` + `--reveal-delay` CSS variable).
- Adds spotlight hover effect for cards marked with `data-spotlight`.
- Adds magnetic pointer movement for elements marked with `data-magnetic`.
- Disables motion-heavy effects when reduced-motion is requested.

### 5. Site shell interactions (`js/site-shell.js`)
- Keeps the navbar readable by toggling `navbar-scrolled` after the same scroll threshold as before.
- Closes the mobile Bootstrap menu after a navigation link is clicked.

### 6. Services panel (`js/services-panel.js`)
- Drives the services switcher in the `#services` section.
- Reads service copy from hidden HTML `<template>` nodes in `index.html` instead of hardcoding content in JavaScript.
- Preserves the original switching animation timing while adding keyboard-accessible tab behavior.


## File and Folder Responsibilities
```text
prozal strona opss/
|- index.html                       # Main page markup and services content templates
|- css/
|  `- style.css                     # Design tokens, layout, effects, responsive rules
|- js/
|  |- site-shell.js                 # Navbar scroll state and mobile menu close behavior
|  |- services-panel.js             # Services tabs, template rendering, keyboard support
|  |- water-bg.js                   # Three.js hero water renderer and lifecycle control
|  |- particles.js                  # Canvas particle system and adaptive performance logic
|  |- section-effects.js            # Reveal, spotlight, and magnetic interactions
|  `- vendor/
|     |- three.module.min.js        # Three.js ES module bundle (vendored)
|     `- three.core.min.js          # Three.js core dependency (vendored)
|- img/                             # Portfolio card images (WebP + PNG fallback pairs)
|- assets/images/                   # Team photos used in About section
|- favicon.svg                      # Browser tab icon
|- .nojekyll                        # Ensures plain static deployment on GitHub Pages
`- portfolio_ui_demos_static_previews.jsx  # Local design/reference file (not loaded by index.html)
```

## Running Locally
Because `water-bg.js` is an ES module import, run this site through a local HTTP server ==**(do not rely on `file://`)**==

Option A (Python):
```bash
cd "prozal strona opss"
python -m http.server 8080
```

Option B (Node):
```bash
cd "prozal strona opss"
npx serve .
```

Then open:
- `http://localhost:8080` (Python)
- or the URL printed by `serve`
- **or just use the github page provided**


## Performance and Accessibility Notes
- `prefers-reduced-motion` supported in CSS and JS effects.
- Heavy animations are paused when not visible.
- `requestAnimationFrame` loops are used for animation timing.
- Passive scroll listeners are used where applicable.
- Hero rendering pixel ratio is capped for stability on high-DPI devices.
- Images use `loading="lazy"` where appropriate.
- Portfolio cards use `<picture>` with WebP first and PNG fallback.
