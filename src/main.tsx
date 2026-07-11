import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Check,
  Copy,
  Download,
  Expand,
  FileText,
  Lightbulb,
  Moon,
  MoreHorizontal,
  Shrink,
  Sun,
  X,
} from 'lucide-react';
import './styles.css';

type Mode = 'essay' | 'poem';
type Theme = 'light' | 'dark';
type FontStyle = 'serif' | 'sans';

type SavedDocument = {
  title: string;
  content: string;
  mode: Mode;
  theme: Theme;
  fontStyle: FontStyle;
  updatedAt: number;
};

const STORAGE_KEY = 'luma-writing-studio-document';

const prompts: Record<Mode, string[]> = {
  essay: [
    'What do you believe now that you did not believe a year ago?',
    'Describe a small choice that quietly changed everything.',
    'What does home mean when it is no longer a place?',
    'Write about a rule you once followed without questioning it.',
  ],
  poem: [
    'Write about a room after everyone has left.',
    'Begin with the line: “The moon forgot my name.”',
    'Describe silence without using the word silence.',
    'Write about an ordinary object as if it were the last one on earth.',
  ],
};

function loadDocument(): SavedDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedDocument) : null;
  } catch {
    return null;
  }
}

function formatTime(date: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function safeFilename(title: string) {
  return title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'untitled';
}

function App() {
  const initial = useMemo(() => loadDocument(), []);
  const [title, setTitle] = useState(initial?.title ?? 'Untitled');
  const [content, setContent] = useState(initial?.content ?? '');
  const [mode, setMode] = useState<Mode>(initial?.mode ?? 'essay');
  const [theme, setTheme] = useState<Theme>(initial?.theme ?? 'light');
  const [fontStyle, setFontStyle] = useState<FontStyle>(initial?.fontStyle ?? 'serif');
  const [focusMode, setFocusMode] = useState(false);
  const [savedAt, setSavedAt] = useState(initial?.updatedAt ?? Date.now());
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [showMenu, setShowMenu] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const words = useMemo(() => {
    const trimmed = content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [content]);

  const characters = content.length;
  const charactersWithoutSpaces = content.replace(/\s/g, '').length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 220));
  const activePrompt = prompts[mode][promptIndex % prompts[mode].length];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(430, textarea.scrollHeight)}px`;
  }, [content, fontStyle, mode, showPrompt]);

  useEffect(() => {
    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      const next: SavedDocument = {
        title,
        content,
        mode,
        theme,
        fontStyle,
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedAt(next.updatedAt);
      setSaveState('saved');
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [title, content, mode, theme, fontStyle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        const updatedAt = Date.now();
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ title, content, mode, theme, fontStyle, updatedAt }),
        );
        setSavedAt(updatedAt);
        setSaveState('saved');
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setFocusMode((current) => !current);
      }

      if (event.key === 'Escape') {
        setShowMenu(false);
        if (focusMode) setFocusMode(false);
      }
    };

    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', closeMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', closeMenu);
    };
  }, [title, content, mode, theme, fontStyle, focusMode]);

  const copyText = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${content}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
    setShowMenu(false);
  };

  const downloadText = () => {
    const blob = new Blob([`${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFilename(title)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const openPrompt = () => {
    setPromptIndex((index) => index + 1);
    setShowPrompt(true);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  return (
    <main className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <header className="app-header">
        <a className="wordmark" href="#" aria-label="Luma home">
          Luma<span>.</span>
        </a>

        <div className="save-state" aria-live="polite">
          <span className={saveState} />
          {saveState === 'saving' ? 'Saving' : `Saved ${formatTime(savedAt)}`}
        </div>

        <nav className="header-actions" aria-label="Document actions">
          <button
            className="icon-control"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'Use dark theme' : 'Use light theme'}
            title={theme === 'light' ? 'Dark theme' : 'Light theme'}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          <button
            className="text-control"
            onClick={() => setFocusMode((current) => !current)}
            title="Focus mode (Ctrl/⌘ + K)"
          >
            {focusMode ? <Shrink size={16} /> : <Expand size={16} />}
            <span>{focusMode ? 'Exit focus' : 'Focus'}</span>
          </button>

          <div className="menu" ref={menuRef}>
            <button
              className="icon-control"
              onClick={() => setShowMenu((current) => !current)}
              aria-label="More document actions"
              aria-expanded={showMenu}
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <div className="menu-popover">
                <button onClick={copyText}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy document'}
                </button>
                <button onClick={downloadText}>
                  <Download size={16} />
                  Export as text
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <div className="page-layout">
        <aside className="document-controls" aria-label="Writing settings">
          <section>
            <p className="control-label">Document</p>
            <div className="mode-control" role="group" aria-label="Document type">
              <button className={mode === 'essay' ? 'active' : ''} onClick={() => setMode('essay')}>
                Essay
              </button>
              <button className={mode === 'poem' ? 'active' : ''} onClick={() => setMode('poem')}>
                Poem
              </button>
            </div>
          </section>

          <section>
            <p className="control-label">Typeface</p>
            <div className="font-control" role="group" aria-label="Typeface">
              <button className={fontStyle === 'serif' ? 'active' : ''} onClick={() => setFontStyle('serif')}>
                Serif
              </button>
              <button className={fontStyle === 'sans' ? 'active' : ''} onClick={() => setFontStyle('sans')}>
                Sans
              </button>
            </div>
          </section>

          <button className="prompt-control" onClick={openPrompt}>
            <Lightbulb size={15} />
            Writing prompt
          </button>

          <p className="local-note">Stored locally in this browser.</p>
        </aside>

        <article className={`writing-page ${fontStyle} ${mode}`}>
          <div className="page-meta">
            <span><FileText size={13} /> {mode === 'essay' ? 'Essay' : 'Poem'}</span>
            <span>{fontStyle === 'serif' ? 'Serif' : 'Sans'}</span>
          </div>

          <input
            className="title-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Document title"
            placeholder="Untitled"
            spellCheck
          />

          {showPrompt && (
            <div className="prompt-panel">
              <div>
                <span>Prompt</span>
                <p>{activePrompt}</p>
              </div>
              <button onClick={() => setShowPrompt(false)} aria-label="Dismiss prompt">
                <X size={15} />
              </button>
            </div>
          )}

          <textarea
            ref={editorRef}
            className="editor-field"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              mode === 'essay'
                ? 'Start writing…'
                : 'Let the first line arrive…'
            }
            spellCheck
            autoFocus
          />

          <footer className="document-stats" aria-label="Document statistics">
            <span><strong>{words.toLocaleString()}</strong> words</span>
            <span title={`${charactersWithoutSpaces.toLocaleString()} characters without spaces`}>
              <strong>{characters.toLocaleString()}</strong> characters
            </span>
            <span><strong>{readingMinutes}</strong> min read</span>
          </footer>
        </article>
      </div>

      {focusMode && (
        <button className="focus-close" onClick={() => setFocusMode(false)}>
          <X size={15} />
          Exit focus
        </button>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
