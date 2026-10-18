# Privacy Policy — QuickInspect

**Last updated:** October 18, 2026

## Overview

QuickInspect is a browser extension that shows an element's selectors, Playwright locators, box model, computed styles, accessibility information and event listeners while you hold a key and hover it, without opening DevTools.

**QuickInspect does not transmit, sell, or share any personal data or user data of any kind. Everything it reads stays in your browser.**

---

## Data the extension does NOT collect

- No browsing history or visited URLs
- No page content is stored or sent anywhere; it is only read to show the panel
- No keystrokes or form values; key presses are only checked for the hold key and shortcuts, never recorded
- No analytics, telemetry, or crash reporting
- No account registration or login of any kind

---

## What the extension reads

While you hold the hold key (`Alt` by default) or keep the panel pinned, QuickInspect reads the details of the element you point at: its tag, attributes, text, computed styles, size and position, accessibility role and name, event listeners, and on a development server the file it was written in. These details are only used to draw the panel and are discarded when the panel closes.

To list event listeners, a small script in each page keeps a record of the listeners that page adds. The record lives in the page's own memory and is gone when the page is closed or reloaded.

---

## How the extension works locally

All processing happens entirely on your device:

| What                                        | Where it stays                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Settings (on/off, hold key, panel sections) | `chrome.storage.local` on your device only                                                 |
| Details of the inspected element            | In memory in the tab while the panel is showing; never written to disk or sent to a server |
| Event listener records                      | In memory in the page; never leave the tab                                                 |
| Copied selectors, locators, HTML and text   | Your clipboard, only when you press a copy key or button                                   |
| Edits made to styles, attributes or text    | Only in the page you edited; gone on reload                                                |

The extension communicates solely through the browser's own extension APIs (`chrome.storage`, `chrome.runtime`, `chrome.tabs`, `chrome.scripting`). No external servers, APIs, or third-party services are contacted.

---

## Local development servers

When a page is served by a Vite or Next.js development server, QuickInspect asks that same server where the inspected element was written, and when you press `O` it asks the server to open that file in your editor. These requests go only to the server already serving the page, usually on your own machine, and carry nothing but the file and line being looked up.

---

## External resources

None. The fonts and styles used by the panel and popup are bundled with the extension, so nothing is loaded from external servers.

---

## Changes to this policy

If the extension is updated in a way that changes how data is handled, this document will be updated and the "Last updated" date above will change.

---

## Contact

For questions or concerns, open an issue at [github.com/KostaD02/QuickInspect](https://github.com/KostaD02/QuickInspect/issues) or contact me at [konstantine@datunishvili.ge](mailto:konstantine@datunishvili.ge)
