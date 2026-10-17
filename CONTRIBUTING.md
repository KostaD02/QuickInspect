# Contributing to QuickInspect

## Project structure

```
src/
├── content/
│   ├── main.ts          # Content script entry: loads settings, wires the inspector
│   ├── inspector/       # State machine: modifier key, pointer, pin, copy, navigate
│   ├── bridge/          # Main-world script: wraps addEventListener, answers event probes
│   ├── handover/        # Lets a newly injected content script retire the one already on the page
│   ├── host/            # Closed shadow root that isolates the UI from page CSS
│   ├── overlay/         # Margin / padding / content highlight and label
│   ├── panel/           # Floating info panel rendering, plus panel.scss for the shadow root styles
│   ├── edits/           # In-place style, attribute and text edits with revert
│   ├── tokens/          # Declares the @kostad/brand tokens on the shadow root
│   ├── toast/           # "Copied" feedback
│   └── actions/         # Copy actions and their key bindings
│
├── popup/
│   ├── index.html       # Settings popup markup, built from brand components
│   ├── main.ts          # Loads the bundled fonts and brand CSS, mounts PopupController
│   ├── style.css        # The few rules @kostad/brand has no class for
│   ├── controller/      # Reads, writes and reflects settings
│   └── page/            # Reaches the active tab's content script, injecting it when missing, to ask about editor availability
│
└── shared/
    ├── consts/          # APP_NAME, default settings, storage keys
    ├── types/           # LensSettings, ElementInfo
    └── util/
        ├── a11y/        # Role and accessible name computation
        ├── selector/    # Short unique CSS selectors
        ├── xpath/       # XPath generation
        ├── locator/     # Playwright locator ranking and match counting
        ├── inspect/     # Builds ElementInfo (box, styles, attributes, media)
        ├── dom/         # Shadow-aware hit testing and querying
        ├── events/      # Asks the main-world bridge for an element's listeners
        ├── format/      # px, hex colors, truncation
        ├── settings/    # Load, save, watch, normalise
        ├── clipboard/
        └── logger/
```

Every folder under `content/`, `popup/` and `shared/util/` holds one module named after the folder, with its `*.spec.ts` beside it where one exists, so `inspector/` is `inspector.ts` and `inspector.spec.ts`. Entry and page-level files (`main.ts`, `index.html`, `style.css`, `brand.d.ts`) stay at the top of their script.

## Setting up for local development

**Requirements:** Node.js 22+, pnpm

```bash
pnpm install
pnpm start
```

Then load the unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

The extension hot-reloads while `pnpm start` is running.

## Build, lint and test

```bash
pnpm build            # tsc, bridge IIFE into bridge/, vite build, zip into release/
pnpm build:bridge     # only the main-world bridge (bridge/bridge.js, git-ignored)
pnpm lint
pnpm test
pnpm test:coverage    # 80% threshold enforced
```

Husky runs `lint` and `test` before every commit and `commitlint` on the message. Commits follow [Conventional Commits](https://www.conventionalcommits.org/).

## Styling

Colours, fonts, radii, shadows and motion come from [`@kostad/brand`](https://www.npmjs.com/package/@kostad/brand); use its `--kd-*` tokens instead of literal values.

- **Popup:** imports the full brand stylesheet and is styled with its classes only: components (`kd-toggle`, `kd-field`, `kd-btn`, `kd-status-pill`, `kd-card`, `kd-chip`, `kd-list`) and utilities (`kd-d-flex`, `kd-gap-*`, `kd-fs-*`, `kd-text-*`, …). `style.css` holds only what the brand has no class for; reach for a brand class before adding a rule there. Poppins, Raleway and JetBrains Mono are bundled from `@fontsource`, so the popup makes no network requests.
- **Panel:** lives in a shadow root, which cannot see the brand's `:root` tokens, so `tokens.ts` declares them on `:host` from `@kostad/brand/tokens.json`. `panel.scss` compiles only the brand partials the panel uses (reset, button, card, chip, field, status pill and the utilities) through Sass's `pkg:` importer, so the markup in `panel.ts`, `overlay.ts` and `toast.ts` is styled with brand classes like the popup; the `CLS` map in `panel.ts` keeps a plain hook class first (`row`, `copy`, `editable`, …) for code and tests. The residual rules in `panel.scss` are placement, the row grid, syntax colours and states. Only the dark theme is used, and the panel cannot load font files without touching the page, so a system face stands in for Poppins.

## How the inspector works

- Nothing is mounted until the modifier key goes down. On `keydown` the shadow host is appended to `<html>` and a single `requestAnimationFrame` loop runs while the pointer moves.
- Hit testing uses `elementFromPoint` and descends into open shadow roots. The extension's own host is ignored.
- `ElementInfo` is computed once per element change. Computed styles, selectors and locator match counts are only read for the element under the cursor. Scrolling only moves the highlight; a resize inspects the element again because its layout may have changed.
- While the key is held, `mousedown`, `click`, `auxclick` and `contextmenu` are swallowed in the capture phase so Alt-click does not download links. The `keyup` of the modifier is `preventDefault`ed so a lone Alt does not focus the browser menu bar.
- The panel has `pointer-events: none` while following the cursor and becomes interactive when pinned.
- Event listeners: `src/content/bridge/bridge.ts` is built separately as a plain IIFE (`vite.bridge.config.ts`, output in the git-ignored `bridge/`; Chrome ignores files whose name starts with a dot, so the folder has none) so Chrome runs it synchronously in the page's main world at `document_start`, before any page script. It wraps `EventTarget.prototype.addEventListener` and `removeEventListener` to keep a registry and answers a `quickinspect:probe` CustomEvent with a JSON reply, which the isolated content script reads synchronously. crxjs's own main-world loader is an async `import()` that would miss listeners added during parsing, hence the separate build.
