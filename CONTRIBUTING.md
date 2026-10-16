# Contributing to QuickInspect

## Project structure

```
src/
├── content/
│   ├── main.ts          # Content script entry: loads settings, wires the inspector
│   ├── inspector.ts     # State machine: modifier key, pointer, pin, copy, navigate
│   ├── bridge.ts        # Main-world script: wraps addEventListener, answers event probes
│   ├── host.ts          # Closed shadow root that isolates the UI from page CSS
│   ├── overlay.ts       # Margin / padding / content highlight and label
│   ├── panel.ts         # Floating info panel rendering
│   ├── panel.css        # Panel, overlay and toast styles (brand tokens)
│   ├── toast.ts         # "Copied" feedback
│   └── actions.ts       # Copy actions and their key bindings
│
├── popup/
│   ├── index.html       # Settings popup markup
│   ├── controller.ts    # Reads, writes and reflects settings
│   ├── main.ts          # Mounts PopupController
│   └── style.css
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

## How the inspector works

- Nothing is mounted until the modifier key goes down. On `keydown` the shadow host is appended to `<html>` and a single `requestAnimationFrame` loop runs while the pointer moves.
- Hit testing uses `elementFromPoint` and descends into open shadow roots. The extension's own host is ignored.
- `ElementInfo` is computed once per element change. Computed styles, selectors and locator match counts are only read for the element under the cursor.
- While the key is held, `mousedown`, `click`, `auxclick` and `contextmenu` are swallowed in the capture phase so Alt-click does not download links. The `keyup` of the modifier is `preventDefault`ed so a lone Alt does not focus the browser menu bar.
- The panel has `pointer-events: none` while following the cursor and becomes interactive when pinned.
- Event listeners: `src/content/bridge.ts` is built separately as a plain IIFE (`vite.bridge.config.ts`, output in the git-ignored `bridge/`; Chrome ignores files whose name starts with a dot, so the folder has none) so Chrome runs it synchronously in the page's main world at `document_start`, before any page script. It wraps `EventTarget.prototype.addEventListener` and `removeEventListener` to keep a registry and answers a `quickinspect:probe` CustomEvent with a JSON reply, which the isolated content script reads synchronously. crxjs's own main-world loader is an async `import()` that would miss listeners added during parsing, hence the separate build.
