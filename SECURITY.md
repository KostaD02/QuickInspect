# Security Policy

## Supported Versions

The following versions of QuickInspect are actively supported with security updates.

| Version  | Supported |
| -------- | --------- |
| >= 1.1.0 | ✔️        |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Instead, please report them directly to me by emailing [konstantine@datunishvili.ge](mailto:konstantine@datunishvili.ge).

### General Context

As a browser extension that runs on every page, QuickInspect reads the content, styles and event listeners of the element you inspect, and a small script in each page wraps `addEventListener` so listeners can be listed. All of this happens locally in your browser. QuickInspect does **not** send any page content, settings, or copied values to external servers. The only requests it makes go to the Vite or Next.js development server that is already serving the page, to find and open an element's source file.
