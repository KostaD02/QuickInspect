<h1 align="center">QuickInspect</h1>

<p align="center">
  <img src="public/logo.png" alt="quickinspect-logo" width="120px" height="120px"/>
  <br>
  <em>Hold Alt. Hover. Everything you need.</em>
  <br>
</p>

<p align="center">
  <a href="CONTRIBUTING.md">Contributing Guidelines</a>
  ·
  <a href="https://github.com/KostaD02/QuickInspect/issues">Submit an Issue</a>
</p>

QuickInspect is a Chrome extension that shows the useful 80% of DevTools element inspection without opening DevTools. Hold a modifier key, hover any element, and a floating panel shows its selectors, Playwright locators, box model, computed styles and accessibility information. Release the key and the page is back to normal.

## Features

- **Zero friction** - hold `Alt` (configurable) and hover; nothing is injected into the page until you do
- **Selectors** - a short unique CSS selector and an XPath for the element
- **Playwright locators** - every applicable strategy ranked the way Playwright codegen ranks them (`getByTestId`, `getByRole`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByText`, CSS fallback), each with a live match count so you can see which one is unique. Counts follow Playwright's own matching: case-insensitive substrings by default, `exact: true` only when it narrows the match, long names cut at a word boundary, and elements hidden from assistive tech left out of `getByRole`. JS/TS syntax
- **Box model** - position, size, margin, padding and border, with DevTools-style margin and padding bands drawn on the page
- **Styles** - the computed values that matter: display, position, typography, colors with swatches, and anything that deviates from the default such as `z-index`, `opacity`, `border-radius`, `box-shadow`, flex and grid properties
- **Accessibility** - computed role, accessible name, focusability, `tabindex` and every `aria-*` attribute
- **Context** - ancestor chain, child count, text content, the shadow host when the element lives inside an open shadow root, and the owning React, Vue, Angular or Svelte component when one can be found (minified production names are left out)
- **Media** - natural size, source, alt text and duration for images, video, audio, canvas and SVG
- **Events** - listeners registered with `addEventListener` (with capture, once and passive flags), inline `on*` handlers, React props, Vue invokers and jQuery handlers
- **Source** - on a dev server the Context section shows where the element was written and `O` opens that line in your editor. Reads the markers Qwik, Astro, Nuxt and code-inspector-plugin stamp on elements, Svelte's dev metadata, React's debug source or owner stack, then calls the Vite or Next.js open-in-editor endpoint. Production builds carry none of this, so the row only appears in development
- **Copy anything** - one key per payload while hovering: `S` selector, `X` XPath, `L` best Playwright locator, `H` outer HTML, `T` text
- **Pin and navigate** - click to pin the panel so it becomes scrollable, clickable and draggable by its head, `↑` / `↓` to walk to the parent or first child, `Esc` to close
- **Edit in place** - in a pinned panel, click a value to change it on the page: computed styles, width and height, margin, padding and border width, attributes, `role`, `aria-*`, media sources and the text of leaf elements. `+ style` and `+ attribute` add new ones, `×` removes an attribute and `reset` undoes every edit on the element. Edits only live in the page and are gone on reload
- **Shadow DOM aware** - hit testing descends into open shadow roots, selectors are scoped to the element's root, and locator counts pierce shadow roots like Playwright does
- **Main-world bridge** - a tiny script injected at `document_start` wraps `addEventListener` so listeners can be listed without the debugger API; nothing else runs in the page world
- **Framework agnostic** - works on any page; nothing leaves the browser

## Usage

1. Hold **Alt** (or the key picked in the popup) and move the mouse over the page
2. The element under the cursor is highlighted and the panel follows the cursor
3. Press a copy key, or **click** to pin the panel and use the copy buttons
4. Release **Alt** to hide everything, or press **Esc** when pinned

| Key             | Action                                                    |
| --------------- | --------------------------------------------------------- |
| hold `Alt`      | Inspect the element under the cursor                      |
| `click`         | Pin or unpin the panel                                    |
| drag the head   | Move a pinned panel                                       |
| click a value   | Edit it in a pinned panel                                 |
| `Esc`           | Close                                                     |
| `↑` / `↓`       | Move to the parent / first child (pins)                   |
| `S` / `X` / `L` | Copy CSS selector / XPath / best locator                  |
| `H` / `T`       | Copy outer HTML / text content                            |
| `O`             | Open the element's source in the editor (dev server only) |

Keys pressed while typing in a text field go to the field unless the hold key is down. With `Shift` as the hold key, text fields are left alone completely so capital letters still type.

## Settings

Open the popup from the toolbar icon. The pill toggles the extension on and off, the key picker sets the hold key, and the gear opens the rest of the settings. Changes are saved to `chrome.storage.local` and applied to open tabs immediately.

| Setting                 | Default | Effect                                                                           |
| ----------------------- | ------- | -------------------------------------------------------------------------------- |
| **Enabled**             | On      | Master switch                                                                    |
| **Hold key**            | Alt     | `Alt`, `Ctrl`, `Shift` or `Cmd`/`Win`                                            |
| **Allow edits**         | On      | Click values in a pinned panel to change styles, attributes and text             |
| **Editor availability** | On      | Show in the popup whether the current page can open sources in your editor       |
| **Box model highlight** | On      | Margin and padding bands around the hovered element                              |
| **Panel sections**      | All on  | Toggle Selectors, Box, Events, Styles, Accessibility, Attributes, Context, Media |

## Permissions

| Permission       | Reason                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `storage`        | Persist settings                                                                                |
| `clipboardWrite` | Copy selectors, locators, HTML and text from the panel                                          |
| `scripting`      | Start QuickInspect in a tab that was already open before the extension was installed or updated |
| `activeTab`      | Access the current tab when you open the popup, so QuickInspect can start there                 |

The content scripts are registered for every `http`, `https` and `file` page so the hold key works anywhere, which Chrome lists as access to all sites. `file://` pages also need **Allow access to file URLs** on the extension's details page.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, structure and testing.

## License

[MIT](./LICENSE) © Konstantine Datunishvili
