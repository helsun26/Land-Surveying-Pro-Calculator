# Calculator — Land Surveying Pro (Installable)

This folder contains the calculator app. I completed the work to turn it into an installable Progressive Web App (PWA) and also provided a minimal Electron wrapper so you can run it as a native desktop app.

What I added

- PWA support
  - manifest.json (name, icons, display=standalone, start_url)
  - service worker (sw.js) — caches the app shell for offline usage
  - icons (SVG placeholders) placed under `icons/`
  - `beforeinstallprompt` handling with an "Install App" button in the UI
- Electron scaffold (optional)
  - package.json with scripts
  - electron-main.js and preload.js for a minimal desktop wrapper
- Accessibility and UX improvements
  - improved focus outlines, touch-friendly buttons, install hints
- Security
  - The parser uses shunting-yard + RPN; input is sanitized before evaluation. No eval/Function usage.

How to use (PWA)

1. Host the repository on a static host (GitHub Pages, Netlify, Surge) or browse locally using a simple static server (service workers require HTTPS or localhost):

   python3 -m http.server 8000
   # then open http://localhost:8000/calculator/index.html

2. From Chrome/Edge/Firefox (desktop and Android):
   - When visiting the page the browser should prompt to "Install" if supported.
   - Or click the "Install App" button in the UI (appears when the browser fires beforeinstallprompt).

3. On iOS (Safari) there is partial support: use Share → "Add to Home Screen" to install (Service Worker support on iOS is limited).

How to run as a desktop app (Electron) — optional

1. Install dev deps (on your machine):
   npm install

2. Run in development mode:
   npm run start

3. Package for distribution (example using electron-packager):
   npm run package

Note: packaging requires native toolchain and electron-packager; see their docs for platform-specific notes.

Notes & next improvements

- The icons are SVG placeholders; for full app-store or platform polish generate PNG icons at multiple sizes (192/512) and replace `icons/*` in the manifest.
- Add an optional degrees/radians toggle for trig functions (currently trig uses radians).
- Add unit tests for the parser and evaluator.
- Add localization if you want other languages.

If you'd like, I can
- Generate PNG icons and update the manifest.
- Add a degrees/radians toggle and UI for survey-specific calculations (offsets, coordinate distribution).
- Open a pull request into the default branch with a summary and screenshots.
