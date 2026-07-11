# Luma

A quiet, distraction-free writing space for essays, poems, and everything in between.

**Live app:** https://luma-one-theta.vercel.app

## About

Luma is a minimal writing editor designed to keep the interface out of the way. It runs entirely in the browser, saves drafts locally, and gives you the essential tools to write without turning the page into a dashboard.

## Features

- Essay and poem layouts
- Live word and character counts
- Character count with and without spaces
- Estimated reading time
- Local autosave
- Light and dark themes
- Distraction-free focus mode
- Serif and sans-serif typefaces
- Writing prompts
- Copy and plain-text export
- Responsive design
- Reduced-motion support

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + S` | Save immediately |
| `Ctrl/⌘ + K` | Toggle focus mode |
| `Escape` | Exit focus mode or close menus |

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Tech stack

React, TypeScript, Vite, Lucide icons, and plain CSS.

## Privacy

Luma does not send your writing to a server. Drafts and preferences are stored in your browser using `localStorage`. Clearing browser data will remove the saved draft, so export important work regularly.
