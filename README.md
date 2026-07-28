# Luma

A quiet writing space for essays, poems, notes, and long-form drafts.

**Live app:** https://luma-one-theta.vercel.app

Luma is designed to feel like a page, not a dashboard. It keeps the interface restrained while providing practical tools for managing writing projects and listening to music.

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

### YouTube music panel

- Clean right-side music drawer
- Search songs, artists, mixes, and playlists with YouTube Data API v3
- Popular music view based on the viewer's region
- Embedded YouTube playback controlled through the IFrame Player API
- Play, pause, previous, next, seek, volume, shuffle, repeat-all, and repeat-one
- Queue management and manual reordering
- Create, rename, play, shuffle, and delete Luma playlists
- Compact playback controls remain available in focus mode
- API key settings inside the music drawer
- Supports either a browser-local key or a shared `YOUTUBE_API_KEY` Vercel environment variable

The API key is used only for YouTube search and metadata. Video playback uses YouTube's official embedded player.

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

Luma does not send document content to a server. Writing, settings, queues, playlists, and an optional browser-local YouTube API key remain in browser storage.

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
- YouTube Data API v3
- YouTube IFrame Player API
- Vercel serverless function for YouTube search

## YouTube configuration

Open the music drawer and select **Settings** to save a YouTube Data API v3 key in the current browser. For a shared deployment, add `YOUTUBE_API_KEY` to the Vercel project's environment variables and redeploy.

Restrict the key to the YouTube Data API v3 in Google Cloud. Do not commit the key to GitHub.

## Local data

Luma stores writing, preferences, queues, and playlists under the browser origin where the app is opened. Clearing site data removes them. Use **Export local backup** from the document menu to protect writing.
