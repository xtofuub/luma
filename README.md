# Luma

A quiet writing space for essays, poems, notes, and long-form drafts.

**Live app:** https://luma-one-theta.vercel.app

Luma is designed to feel like a page, not a dashboard. It keeps the interface restrained while providing practical tools for managing writing projects and listening to online music.

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

### Online music player

- Online track search and weekly trending music powered by Audius
- Direct in-app streaming without Spotify Premium or a Spotify Client ID
- Create, rename, play, shuffle, and delete Luma playlists
- Add and remove online tracks from playlists
- Queue tracks and reorder what plays next
- Play, pause, previous, next, seek, volume, shuffle, repeat-all, and repeat-one controls
- Compact music controls remain available in focus mode
- Browser Media Session support for operating-system media controls
- Album artwork and artist information

The available catalog is Audius's open music catalog rather than Spotify's or YouTube's full catalog. Search and track streaming use Luma's `/api/audius` Vercel function and Audius's official API.

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

Luma does not send document content to a server. Writing, settings, music queues, and Luma playlists remain in browser storage. Music audio streams from Audius.

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
- Browser Audio and Media Session APIs
- Vercel serverless function for Audius search

An optional `AUDIUS_API_KEY` environment variable can be added later for higher Audius API rate limits. The current read-only player works without requiring users to sign in.

## Local data

Luma stores writing, preferences, playlists, and queues under the browser origin where the app is opened. Clearing site data removes them. Use **Export local backup** from the document menu to protect writing.
