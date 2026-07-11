import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArchiveRestore,
  Check,
  ChevronRight,
  Copy,
  Download,
  Expand,
  FilePlus2,
  FileText,
  Files,
  Lightbulb,
  Moon,
  MoreHorizontal,
  Replace,
  Search,
  Shrink,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import './styles.css';

type Mode = 'essay' | 'poem';
type Theme = 'light' | 'dark';
type FontStyle = 'serif' | 'sans';

type LumaDocument = {
  id: string;
  title: string;
  content: string;
  mode: Mode;
  fontStyle: FontStyle;
  wordGoal: number | null;
  createdAt: number;
  updatedAt: number;
};

type LumaState = {
  version: 2;
  activeId: string;
  theme: Theme;
  documents: LumaDocument[];
};

type LegacyDocument = {
  title?: string;
  content?: string;
  mode?: Mode;
  theme?: Theme;
  fontStyle?: FontStyle;
  updatedAt?: number;
};

const STORAGE_KEY = 'luma-state-v2';
const LEGACY_STORAGE_KEY = 'luma-writing-studio-document';

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

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDocument(overrides: Partial<LumaDocument> = {}): LumaDocument {
  const now = Date.now();
  return {
    id: makeId(),
    title: 'Untitled',
    content: '',
    mode: 'essay',
    fontStyle: 'serif',
    wordGoal: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loadState(): LumaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LumaState>;
      if (parsed.version === 2 && Array.isArray(parsed.documents) && parsed.documents.length > 0) {
        const documents = parsed.documents.map((document) => ({
          ...createDocument(),
          ...document,
          wordGoal: typeof document.wordGoal === 'number' && document.wordGoal > 0
            ? Math.round(document.wordGoal)
            : null,
        }));
        const activeId = documents.some((document) => document.id === parsed.activeId)
          ? parsed.activeId as string
          : documents[0].id;
        return {
          version: 2,
          activeId,
          theme: parsed.theme === 'dark' ? 'dark' : 'light',
          documents,
        };
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyDocument;
      const document = createDocument({
        title: legacy.title || 'Untitled',
        content: legacy.content || '',
        mode: legacy.mode === 'poem' ? 'poem' : 'essay',
        fontStyle: legacy.fontStyle === 'sans' ? 'sans' : 'serif',
        updatedAt: legacy.updatedAt || Date.now(),
      });
      return {
        version: 2,
        activeId: document.id,
        theme: legacy.theme === 'dark' ? 'dark' : 'light',
        documents: [document],
      };
    }
  } catch {
    // Fall through to a clean local state.
  }

  const document = createDocument();
  return { version: 2, activeId: document.id, theme: 'light', documents: [document] };
}

function countWords(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function safeFilename(title: string) {
  return title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'untitled';
}

function formatSavedTime(date: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatRelativeTime(date: number) {
  const difference = Date.now() - date;
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const initial = useMemo(loadState, []);
  const [documents, setDocuments] = useState(initial.documents);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [focusMode, setFocusMode] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [savedAt, setSavedAt] = useState(() => {
    return initial.documents.find((document) => document.id === initial.activeId)?.updatedAt ?? Date.now();
  });
  const [documentSearch, setDocumentSearch] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeId) ?? documents[0],
    [documents, activeId],
  );

  const words = useMemo(() => countWords(activeDocument.content), [activeDocument.content]);
  const characters = activeDocument.content.length;
  const charactersWithoutSpaces = activeDocument.content.replace(/\s/g, '').length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 220));
  const activePrompt = prompts[activeDocument.mode][promptIndex % prompts[activeDocument.mode].length];
  const goalProgress = activeDocument.wordGoal
    ? Math.min(100, Math.round((words / activeDocument.wordGoal) * 100))
    : null;

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    return [...documents]
      .filter((document) => {
        if (!query) return true;
        return `${document.title}\n${document.content}`.toLocaleLowerCase().includes(query);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, documentSearch]);

  const matchPositions = useMemo(() => {
    if (!findQuery) return [];
    const positions: number[] = [];
    const haystack = activeDocument.content.toLocaleLowerCase();
    const needle = findQuery.toLocaleLowerCase();
    let offset = 0;
    while (offset <= haystack.length - needle.length) {
      const index = haystack.indexOf(needle, offset);
      if (index === -1) break;
      positions.push(index);
      offset = index + Math.max(needle.length, 1);
    }
    return positions;
  }, [activeDocument.content, findQuery]);

  const updateActiveDocument = (patch: Partial<LumaDocument>) => {
    const updatedAt = Date.now();
    setDocuments((current) => current.map((document) => (
      document.id === activeDocument.id ? { ...document, ...patch, updatedAt } : document
    )));
    setSavedAt(updatedAt);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(430, textarea.scrollHeight)}px`;
  }, [activeDocument.content, activeDocument.fontStyle, activeDocument.mode, showPrompt]);

  useEffect(() => {
    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      const state: LumaState = { version: 2, activeId, theme, documents };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveState('saved');
      setSavedAt(activeDocument.updatedAt);
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [documents, activeId, theme, activeDocument.updatedAt]);

  useEffect(() => {
    setCurrentMatch(0);
  }, [findQuery, activeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeId, theme, documents }));
        setSavedAt(Date.now());
        setSaveState('saved');
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setFocusMode((current) => !current);
      }
      if (modifier && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setShowFind(true);
        window.setTimeout(() => findInputRef.current?.focus(), 0);
      }
      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createNewDocument();
      }
      if (event.key === 'Escape') {
        setShowMenu(false);
        setShowLibrary(false);
        if (showFind) {
          setShowFind(false);
          return;
        }
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
  });

  const selectDocument = (id: string) => {
    setActiveId(id);
    setShowLibrary(false);
    setShowPrompt(false);
    setShowFind(false);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const createNewDocument = () => {
    const document = createDocument();
    setDocuments((current) => [document, ...current]);
    setActiveId(document.id);
    setShowLibrary(false);
    setShowPrompt(false);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const duplicateDocument = () => {
    const duplicate = createDocument({
      title: activeDocument.title === 'Untitled' ? 'Untitled copy' : `${activeDocument.title} copy`,
      content: activeDocument.content,
      mode: activeDocument.mode,
      fontStyle: activeDocument.fontStyle,
      wordGoal: activeDocument.wordGoal,
    });
    setDocuments((current) => [duplicate, ...current]);
    setActiveId(duplicate.id);
    setShowMenu(false);
  };

  const deleteDocument = () => {
    const confirmed = window.confirm(`Delete “${activeDocument.title || 'Untitled'}”? This cannot be undone.`);
    if (!confirmed) return;

    if (documents.length === 1) {
      const blank = createDocument();
      setDocuments([blank]);
      setActiveId(blank.id);
    } else {
      const remaining = documents.filter((document) => document.id !== activeDocument.id);
      setDocuments(remaining);
      setActiveId(remaining[0].id);
    }
    setShowMenu(false);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(`${activeDocument.title}\n\n${activeDocument.content}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
    setShowMenu(false);
  };

  const exportDocument = (extension: 'txt' | 'md') => {
    const body = extension === 'md'
      ? `# ${activeDocument.title}\n\n${activeDocument.content}`
      : `${activeDocument.title}\n\n${activeDocument.content}`;
    downloadFile(
      `${safeFilename(activeDocument.title)}.${extension}`,
      body,
      extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    );
    setShowMenu(false);
  };

  const exportBackup = () => {
    const backup: LumaState = { version: 2, activeId, theme, documents };
    downloadFile(
      `luma-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8',
    );
    setShowMenu(false);
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<LumaState>;
      if (parsed.version !== 2 || !Array.isArray(parsed.documents) || parsed.documents.length === 0) {
        throw new Error('Invalid Luma backup');
      }
      const imported = parsed.documents.map((document) => ({ ...createDocument(), ...document }));
      const nextActiveId = imported.some((document) => document.id === parsed.activeId)
        ? parsed.activeId as string
        : imported[0].id;
      setDocuments(imported);
      setActiveId(nextActiveId);
      setTheme(parsed.theme === 'dark' ? 'dark' : 'light');
      setShowMenu(false);
    } catch {
      window.alert('That file is not a valid Luma backup.');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const importText = async (file: File) => {
    const raw = await file.text();
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    const firstLine = raw.split(/\r?\n/)[0]?.replace(/^#\s*/, '').trim();
    const title = firstLine || file.name.replace(/\.[^.]+$/, '') || 'Imported document';
    const content = extension === 'md' && /^#\s/.test(raw)
      ? raw.replace(/^#\s.*(?:\r?\n){1,2}/, '')
      : raw;
    const document = createDocument({ title, content });
    setDocuments((current) => [document, ...current]);
    setActiveId(document.id);
    setShowMenu(false);
    if (textInputRef.current) textInputRef.current.value = '';
  };

  const openPrompt = () => {
    setPromptIndex((index) => index + 1);
    setShowPrompt(true);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const goToMatch = (direction: 1 | -1 = 1) => {
    if (matchPositions.length === 0 || !editorRef.current) return;
    const next = (currentMatch + direction + matchPositions.length) % matchPositions.length;
    setCurrentMatch(next);
    const start = matchPositions[next];
    editorRef.current.focus();
    editorRef.current.setSelectionRange(start, start + findQuery.length);
  };

  const replaceCurrent = () => {
    const textarea = editorRef.current;
    if (!textarea || !findQuery) return;
    const selected = activeDocument.content.slice(textarea.selectionStart, textarea.selectionEnd);
    if (selected.toLocaleLowerCase() !== findQuery.toLocaleLowerCase()) {
      goToMatch(1);
      return;
    }
    const nextContent = `${activeDocument.content.slice(0, textarea.selectionStart)}${replaceQuery}${activeDocument.content.slice(textarea.selectionEnd)}`;
    const nextCursor = textarea.selectionStart + replaceQuery.length;
    updateActiveDocument({ content: nextContent });
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const replaceAll = () => {
    if (!findQuery || matchPositions.length === 0) return;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const content = activeDocument.content.replace(new RegExp(escaped, 'gi'), replaceQuery);
    updateActiveDocument({ content });
    setCurrentMatch(0);
  };

  return (
    <main className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <header className="app-header">
        <a className="wordmark" href="#" onClick={(event) => event.preventDefault()} aria-label="Luma home">
          Luma<span>.</span>
        </a>

        <div className="save-state" aria-live="polite">
          <span className={saveState} />
          {saveState === 'saving' ? 'Saving' : `Saved ${formatSavedTime(savedAt)}`}
        </div>

        <nav className="header-actions" aria-label="Document actions">
          <button
            className="icon-control library-toggle"
            onClick={() => setShowLibrary((current) => !current)}
            aria-label="Open documents"
            title="Documents"
          >
            <Files size={17} />
          </button>

          <button
            className="icon-control"
            onClick={() => {
              setShowFind(true);
              window.setTimeout(() => findInputRef.current?.focus(), 0);
            }}
            aria-label="Find and replace"
            title="Find and replace (Ctrl/⌘ + F)"
          >
            <Search size={17} />
          </button>

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
                <button onClick={() => exportDocument('txt')}>
                  <Download size={16} />
                  Export as text
                </button>
                <button onClick={() => exportDocument('md')}>
                  <FileText size={16} />
                  Export as Markdown
                </button>
                <div className="menu-divider" />
                <button onClick={duplicateDocument}>
                  <Files size={16} />
                  Duplicate document
                </button>
                <button onClick={() => textInputRef.current?.click()}>
                  <Upload size={16} />
                  Import text file
                </button>
                <button onClick={exportBackup}>
                  <ArchiveRestore size={16} />
                  Export local backup
                </button>
                <button onClick={() => backupInputRef.current?.click()}>
                  <Upload size={16} />
                  Restore backup
                </button>
                <div className="menu-divider" />
                <button className="danger" onClick={deleteDocument}>
                  <Trash2 size={16} />
                  Delete document
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <input
        ref={backupInputRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => event.target.files?.[0] && importBackup(event.target.files[0])}
      />
      <input
        ref={textInputRef}
        className="hidden-input"
        type="file"
        accept="text/plain,text/markdown,.txt,.md"
        onChange={(event) => event.target.files?.[0] && importText(event.target.files[0])}
      />

      <div className="page-layout">
        <aside className={`library-panel ${showLibrary ? 'open' : ''}`} aria-label="Document library">
          <div className="library-heading">
            <div>
              <p className="control-label">Library</p>
              <strong>{documents.length} {documents.length === 1 ? 'document' : 'documents'}</strong>
            </div>
            <button className="small-icon-control" onClick={createNewDocument} title="New document (Ctrl/⌘ + N)">
              <FilePlus2 size={16} />
            </button>
          </div>

          <label className="library-search">
            <Search size={14} />
            <input
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
            />
            {documentSearch && (
              <button onClick={() => setDocumentSearch('')} aria-label="Clear document search">
                <X size={13} />
              </button>
            )}
          </label>

          <div className="document-list">
            {filteredDocuments.map((document) => (
              <button
                key={document.id}
                className={`document-item ${document.id === activeDocument.id ? 'active' : ''}`}
                onClick={() => selectDocument(document.id)}
              >
                <span className="document-item-main">
                  <strong>{document.title.trim() || 'Untitled'}</strong>
                  <small>{countWords(document.content).toLocaleString()} words · {formatRelativeTime(document.updatedAt)}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {filteredDocuments.length === 0 && (
              <p className="empty-library">No documents match your search.</p>
            )}
          </div>

          <div className="library-settings">
            <section>
              <p className="control-label">Document type</p>
              <div className="segmented-control" role="group" aria-label="Document type">
                <button
                  className={activeDocument.mode === 'essay' ? 'active' : ''}
                  onClick={() => updateActiveDocument({ mode: 'essay' })}
                >
                  Essay
                </button>
                <button
                  className={activeDocument.mode === 'poem' ? 'active' : ''}
                  onClick={() => updateActiveDocument({ mode: 'poem' })}
                >
                  Poem
                </button>
              </div>
            </section>

            <section>
              <p className="control-label">Typeface</p>
              <div className="segmented-control" role="group" aria-label="Typeface">
                <button
                  className={activeDocument.fontStyle === 'serif' ? 'active' : ''}
                  onClick={() => updateActiveDocument({ fontStyle: 'serif' })}
                >
                  Serif
                </button>
                <button
                  className={activeDocument.fontStyle === 'sans' ? 'active' : ''}
                  onClick={() => updateActiveDocument({ fontStyle: 'sans' })}
                >
                  Sans
                </button>
              </div>
            </section>

            <section>
              <p className="control-label">Word goal</p>
              <div className="goal-control">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={activeDocument.wordGoal ?? ''}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateActiveDocument({ wordGoal: Number.isFinite(value) && value > 0 ? Math.round(value) : null });
                  }}
                  placeholder="None"
                  aria-label="Word goal"
                />
                <span>words</span>
              </div>
            </section>

            <button className="prompt-control" onClick={openPrompt}>
              <Lightbulb size={15} />
              Writing prompt
            </button>

            <p className="local-note">Everything is stored locally in this browser. Export a backup for safekeeping.</p>
          </div>
        </aside>

        {showLibrary && <button className="library-backdrop" aria-label="Close documents" onClick={() => setShowLibrary(false)} />}

        <article className={`writing-page ${activeDocument.fontStyle} ${activeDocument.mode}`}>
          {showFind && (
            <div className="find-panel">
              <div className="find-row">
                <Search size={15} />
                <input
                  ref={findInputRef}
                  value={findQuery}
                  onChange={(event) => setFindQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') goToMatch(event.shiftKey ? -1 : 1);
                  }}
                  placeholder="Find in document"
                  aria-label="Find in document"
                />
                <span className="match-count">
                  {findQuery ? (matchPositions.length ? `${currentMatch + 1}/${matchPositions.length}` : '0/0') : ''}
                </span>
                <button onClick={() => goToMatch(-1)} disabled={matchPositions.length === 0} aria-label="Previous match">↑</button>
                <button onClick={() => goToMatch(1)} disabled={matchPositions.length === 0} aria-label="Next match">↓</button>
                <button onClick={() => setShowReplace((current) => !current)} aria-label="Toggle replace" title="Replace">
                  <Replace size={15} />
                </button>
                <button onClick={() => setShowFind(false)} aria-label="Close find"><X size={15} /></button>
              </div>
              {showReplace && (
                <div className="replace-row">
                  <span />
                  <input
                    value={replaceQuery}
                    onChange={(event) => setReplaceQuery(event.target.value)}
                    placeholder="Replace with"
                    aria-label="Replace with"
                  />
                  <button onClick={replaceCurrent} disabled={!findQuery || matchPositions.length === 0}>Replace</button>
                  <button onClick={replaceAll} disabled={!findQuery || matchPositions.length === 0}>Replace all</button>
                </div>
              )}
            </div>
          )}

          <div className="page-meta">
            <span><FileText size={13} /> {activeDocument.mode === 'essay' ? 'Essay' : 'Poem'}</span>
            <span>{activeDocument.fontStyle === 'serif' ? 'Serif' : 'Sans'}</span>
          </div>

          <input
            className="title-field"
            value={activeDocument.title}
            onChange={(event) => updateActiveDocument({ title: event.target.value })}
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
            value={activeDocument.content}
            onChange={(event) => updateActiveDocument({ content: event.target.value })}
            placeholder={activeDocument.mode === 'essay' ? 'Start writing…' : 'Let the first line arrive…'}
            spellCheck
            autoFocus
          />

          <footer className="document-stats" aria-label="Document statistics">
            <span><strong>{words.toLocaleString()}</strong> words</span>
            <span title={`${charactersWithoutSpaces.toLocaleString()} characters without spaces`}>
              <strong>{characters.toLocaleString()}</strong> characters
            </span>
            <span><strong>{readingMinutes}</strong> min read</span>
            {activeDocument.wordGoal && goalProgress !== null && (
              <span className="goal-stat" title={`${words.toLocaleString()} of ${activeDocument.wordGoal.toLocaleString()} words`}>
                <i><b style={{ width: `${goalProgress}%` }} /></i>
                <strong>{goalProgress}%</strong> goal
              </span>
            )}
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
