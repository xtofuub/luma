# Luma

A quiet, local-first writing space for essays, poems, notes, and long-form drafts.

**Live app:** https://luma-one-theta.vercel.app

Luma is designed to feel like a page, not a dashboard. It keeps the interface restrained while providing the practical tools needed to manage and protect real writing projects.

## Features

### Writing

- Essay and poem layouts
- Serif and sans-serif typography
- Distraction-free focus mode
- Live word and character counts
- Character count without spaces
- Estimated reading time
- Optional per-document word goals
- Writing prompts
- Find and replace
- Six color palettes, each with light and dark variants
- Smooth Web Audio typing sounds with Butter, Deep thock, and Felt presets

### Document library

- Multiple locally saved documents
- Full-text search across titles and content
- Create, rename, duplicate, and delete documents
- Word counts and last-edited times in the library
- Automatic migration from the earlier single-document version

### Music queue

- Add multiple audio files from your device
- Play, pause, seek, skip, shuffle, and repeat
- Reorder or remove tracks from the queue
- Compact music controls remain available in focus mode
- Music files stay on the device and are never uploaded

### Import, export, and safety

- Automatic local saving
- Import `.txt` and `.md` files
- Export individual documents as plain text or Markdown
- Export every document and preference as a portable JSON backup
- Restore a complete Luma backup in another browser

Luma does not send document content or music to a server. Writing and preferences remain in the browser's `localStorage` unless the user explicitly exports a file. Music queues are session-only because browsers do not allow websites to silently reopen local audio files after a refresh.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + N` | Create a new document |
| `Ctrl/⌘ + F` | Open find and replace |
| `Ctrl/⌘ + K` | Toggle focus mode |
| `Ctrl/⌘ + S` | Save immediately |
| `Enter` | Move to the next search match |
| `Shift + Enter` | Move to the previous search match |
| `Escape` | Close the active panel or exit focus mode |

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Tech stack

- React
- TypeScript
- Vite
- Lucide icons
- Plain CSS

No backend, account system, analytics SDK, database, or bundled audio library is required. Typing sounds are synthesized locally with the Web Audio API.

## Local data

Luma stores data under the browser origin where the app is opened. Clearing site data removes locally stored documents. Use **Export local backup** from the document menu to keep important work safe or move it between browsers.
