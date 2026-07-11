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
- Smooth Web Audio typing sounds with Butter, Deep Thock, and Felt presets
- Six color palettes, each with light and dark variants
- YouTube-first mini player with pasted-link playback, queue controls, seeking, shuffle, repeat, and focus-mode controls
- YouTube, YouTube Music, Shorts, and `youtu.be` links work without an API key
- Optional local audio queue for files from the current device

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

Luma does not send document content to a server. Writing and preferences remain in the browser's `localStorage` unless the user explicitly exports a file.

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

No backend, account system, analytics SDK, database, or YouTube API key is required. YouTube links use the official embedded player.

## Local data

Luma stores data under the browser origin where the app is opened. Clearing site data removes locally stored documents. Use **Export local backup** from the document menu to keep important work safe or move it between browsers.

## YouTube mini player

Open the music control, paste a YouTube, YouTube Music, Shorts, or `youtu.be` link, and add it to the queue. Playback uses YouTube's official embedded player and does not require an API key. Local audio files remain available as the secondary source.
