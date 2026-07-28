# Luma

A quiet, local-first writing space for essays, poems, notes, and long-form drafts.

**Live app:** https://luma-one-theta.vercel.app

Luma is designed to feel like a page, not a dashboard. It keeps the interface restrained while providing the practical tools needed to manage writing projects and listen to a private local music library.

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
- Smooth Web Audio typing sounds with Butter, Deep Thock, and Felt presets
- Six color palettes, each with light and dark variants
- Configurable library, document-detail, and writing-stat panels

### Local music library

- Import individual audio files or an entire folder
- Drag and drop audio files into the player
- Search imported tracks by title or artist
- Persistent browser storage using IndexedDB
- Create, rename, play, shuffle, and delete playlists
- Add and remove tracks from playlists
- Queue tracks and reorder what plays next
- Play, pause, previous, next, seek, volume, shuffle, repeat-all, and repeat-one controls
- Compact music controls remain available in focus mode
- Browser Media Session support for operating-system media controls
- Duplicate-file detection during import

Supported browser-playable formats include MP3, WAV, FLAC, M4A, AAC, OGG, Opus, and WebM audio. Actual codec support depends on the browser.

### Document library

- Multiple locally saved documents
- Full-text search across titles and content
- Create, rename, duplicate, and delete documents
- Word counts and last-edited times in the library
- Automatic migration from the earlier single-document version

### Import, export, and safety

- Automatic local saving
- Import `.txt` and `.md` files
- Export individual documents as plain text or Markdown
- Export every document and preference as a portable JSON backup
- Restore a complete Luma backup in another browser

Luma does not send document content or imported music to a server. Writing and preferences use browser storage, while music files use IndexedDB on the current browser and origin.

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
- IndexedDB and the browser Audio API

No backend, account system, analytics SDK, streaming-service login, or API key is required.

## Local data

Luma stores data under the browser origin where the app is opened. Clearing site data removes locally stored documents, settings, playlists, and imported music. Use **Export local backup** from the document menu to protect writing; imported audio should also remain available in its original folder.