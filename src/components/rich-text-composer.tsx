"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import {
  extractClipboardHtmlFragment,
  extractPlainTextFromRichText,
  extractYouTubeVideoId,
  hasMarkdownSyntax,
  htmlFragmentHasBlocks,
  markdownToHtml,
  normalizeRichTextForEditor,
} from "@/lib/rich-text";

const EmojiPicker = dynamic(() => import("@emoji-mart/react").then((m) => m.default), { ssr: false });

// The emoji dataset (~1.5 MB of JSON) and its locale strings are loaded on
// demand the first time the picker opens, so they never ship in the editor's
// initial chunk on article/profile pages.
async function loadEmojiAssets() {
  const [data, i18nEn, i18nUk] = await Promise.all([
    import("@emoji-mart/data").then((m) => m.default),
    import("@emoji-mart/data/i18n/en.json").then((m) => m.default),
    import("@emoji-mart/data/i18n/uk.json").then((m) => m.default),
  ]);
  return { data, i18nEn, i18nUk };
}
type EmojiAssets = Awaited<ReturnType<typeof loadEmojiAssets>>;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InlineAssetUploadResult = { url: string; label?: string | null };

// Capability flags the toolbar reads to decide which tools to render. Image and
// YouTube stay gated by their own props (onUploadInlineAsset / showYouTube).
type EditorFeatures = {
  /** "+" menu with paragraph / heading / quote structural blocks. */
  blocks: boolean;
  /**
   * H2–H4 inside the "+" menu. Split out of `blocks` so a surface can keep
   * quotes and spoilers while dropping document structure: a discussion topic
   * is one continuous thought, and its page already owns the only h1.
   */
  headings: boolean;
  /** Horizontal rule inside the "+" menu. */
  divider: boolean;
  /** Bulleted & numbered lists (surfaced inside the "+" menu). */
  lists: boolean;
  bold: boolean;
  italic: boolean;
  link: boolean;
  code: boolean;
  emoji: boolean;
};

const FULL_FEATURES: EditorFeatures = {
  blocks: true,
  headings: true,
  divider: true,
  lists: true,
  bold: true,
  italic: true,
  link: true,
  code: true,
  emoji: true,
};

// Trimmed toolbar for short-form fields (profile bio, poll description): inline
// emphasis, links, emoji and lists — no structural blocks or code spans.
const COMPACT_FEATURES: EditorFeatures = {
  blocks: false,
  headings: false,
  divider: false,
  lists: true,
  bold: true,
  italic: true,
  link: true,
  code: false,
  emoji: true,
};

type RichTextComposerProps = {
  locale: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  hint?: string;
  maxLength?: number;
  minHeight?: number;
  contentClassName?: string;
  toolbarSuffix?: ReactNode;
  showYouTube?: boolean;
  /** Keep the formatting toolbar pinned to the top of the viewport while scrolling. */
  stickyToolbar?: boolean;
  onUploadInlineAsset?: (
    file: File,
    kind: "image",
  ) => Promise<InlineAssetUploadResult | null>;
  /** Coarse capability preset; "full" (default) enables every tool, "compact" trims to inline formatting + lists. */
  variant?: "full" | "compact";
  /** Per-feature overrides layered on top of `variant`. */
  features?: Partial<EditorFeatures>;
};

type PopoverKind = "link" | "youtube" | null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// Escape user-supplied strings before they go into an insertHTML fragment, so a
// typed link text like "A < B" or a URL with `&` can't break out of the anchor.
// The value is re-sanitised by normalizeRichTextForEditor afterwards, but keeping
// the fragment well-formed here avoids the browser mangling it on insert.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const btnBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition select-none";
const btnIdle =
  "border-transparent text-[color:var(--muted-foreground)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]";
const btnActive =
  "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)]";

function saveSelection(): Range | null {
  const sel = window.getSelection();
  return sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
}

function restoreSelection(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

// Walk up from a selection node to the nearest block whose tag is in `tags`,
// stopping at (and never crossing) the editor root.
function findEnclosingBlock(
  node: Node | null,
  root: HTMLElement,
  tags: string[],
): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      tags.includes((current as HTMLElement).tagName)
    ) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Inline popover for link / YouTube                                  */
/* ------------------------------------------------------------------ */

function InlinePopover({
  kind,
  locale,
  initialText,
  onSubmit,
  onClose,
}: {
  kind: "link" | "youtube";
  locale: string;
  /** Pre-fill for the link-text field (the current selection's text, if any). */
  initialText?: string;
  onSubmit: (value: string, text?: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUk = locale === "uk";
  const isLink = kind === "link";

  const label =
    kind === "link"
      ? isUk
        ? "URL посилання"
        : "Link URL"
      : isUk
        ? "Посилання на YouTube"
        : "YouTube link";

  const textLabel = isUk ? "Текст посилання (необов'язково)" : "Link text (optional)";
  const textPlaceholder = isUk ? "напр. каталог ролей" : "e.g. role catalog";
  const hintText = isUk
    ? "Порожній текст → вставиться саме посилання. Виділіть слова перед відкриттям, щоб зробити їх посиланням."
    : "Empty text → the URL itself is inserted. Select words before opening to turn them into a link.";

  const placeholderText =
    kind === "link" ? "https://example.com" : "https://youtube.com/watch?v=...";

  const submitLabel = isUk ? "Вставити" : "Insert";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleSubmit = () => {
    const val = inputRef.current?.value.trim();
    if (val) onSubmit(val, isLink ? (textRef.current?.value ?? "") : undefined);
    onClose();
  };

  const onFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-80 rounded-2xl border app-border bg-[color:var(--surface)] p-3 shadow-2xl"
    >
      {isLink && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider app-soft">
            {textLabel}
          </p>
          <input
            ref={textRef}
            type="text"
            defaultValue={initialText ?? ""}
            placeholder={textPlaceholder}
            className="mb-3 w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--ring)]"
            onKeyDown={onFieldKeyDown}
          />
        </>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider app-soft">
        {label}
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="url"
          placeholder={placeholderText}
          className="flex-1 rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--ring)]"
          onKeyDown={onFieldKeyDown}
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-xl bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)] transition hover:opacity-90"
        >
          {submitLabel}
        </button>
      </div>
      {isLink && (
        <p className="mt-2 text-xs leading-snug app-soft">{hintText}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function RichTextComposer({
  locale,
  value,
  onChange,
  placeholder,
  label,
  hint,
  maxLength,
  minHeight = 340,
  contentClassName = "",
  toolbarSuffix,
  showYouTube = false,
  stickyToolbar = false,
  onUploadInlineAsset,
  variant = "full",
  features: featuresProp,
}: RichTextComposerProps) {
  const features = useMemo<EditorFeatures>(
    () => ({
      ...(variant === "compact" ? COMPACT_FEATURES : FULL_FEATURES),
      ...featuresProp,
    }),
    [variant, featuresProp],
  );
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blocksMenuRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const mediaInsertRangeRef = useRef<Range | null>(null);
  const pendingMediaInsertRef = useRef(false);
  const lastSyncRef = useRef("");
  const imageInputId = useId();

  const [blocksOpen, setBlocksOpen] = useState(false);
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    code: false,
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiAssets, setEmojiAssets] = useState<EmojiAssets | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  const isUk = locale === "uk";
  const ui = useMemo(
    () =>
      isUk
        ? {
            structureTitle: "Базові блоки",
            insertTitle: "Вставити",
            listTitle: "Списки",
            paragraph: "Параграф",
            heading: "Заголовок 2",
            heading3: "Заголовок 3",
            heading4: "Заголовок 4",
            quote: "Цитата",
            spoiler: "Спойлер",
            spoilerSummary: "Спойлер",
            divider: "Роздільник",
            ul: "Маркований список",
            ol: "Нумерований список",
            bold: "Жирний (Ctrl+B)",
            italic: "Курсив (Ctrl+I)",
            link: "Посилання (Ctrl+K)",
            emoji: "Емодзі",
            code: "Код",
            image: "Фото",
            youtube: "YouTube відео",
            chars: "символів",
            uploading: "Завантаження…",
          }
        : {
            structureTitle: "Basic blocks",
            insertTitle: "Insert",
            listTitle: "Lists",
            paragraph: "Paragraph",
            heading: "Heading 2",
            heading3: "Heading 3",
            heading4: "Heading 4",
            quote: "Quote",
            spoiler: "Spoiler",
            spoilerSummary: "Click to expand",
            divider: "Divider",
            ul: "Bulleted list",
            ol: "Numbered list",
            bold: "Bold (Ctrl+B)",
            italic: "Italic (Ctrl+I)",
            link: "Link (Ctrl+K)",
            emoji: "Emoji",
            code: "Code",
            image: "Image",
            youtube: "YouTube video",
            chars: "characters",
            uploading: "Uploading…",
          },
    [isUk],
  );

  /* ---- sync external value → editor ---- */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = normalizeRichTextForEditor(value);
    // The value we just emitted ourselves must NOT rewrite the editor DOM:
    // re-rendering innerHTML strips empty lines and other valid-but-messy markup
    // the user is actively working with (e.g. a blank paragraph they just added
    // disappears the moment they click away). Only a genuine *external* change —
    // one that normalises to something different from our last emit — is written
    // back, and only while the editor is not focused.
    if (lastSyncRef.current === sanitized) return;
    if (document.activeElement !== el) el.innerHTML = sanitized;
    lastSyncRef.current = sanitized;
  }, [value]);

  /* ---- close blocks dropdown on outside click ---- */
  useEffect(() => {
    if (!blocksOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (blocksMenuRef.current?.contains(e.target)) return;
      setBlocksOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blocksOpen]);

  /* ---- query active formatting state ---- */
  const refreshActiveFormats = useCallback(() => {
    const el = editorRef.current;
    let code = false;
    if (el) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)) {
        code = !!findEnclosingBlock(sel.anchorNode, el, ["CODE"]);
      }
    }
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      code,
    });
  }, []);

  /* ---- core editor helpers ---- */

  // Emit sanitized value to parent WITHOUT touching editor DOM.
  // Replacing innerHTML during editing kills cursor and formatting.
  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = normalizeRichTextForEditor(el.innerHTML);
    lastSyncRef.current = sanitized;
    onChange(sanitized);
  }, [onChange]);

  // On blur (the user is done with this pass) tidy the editor DOM into the clean
  // block structure: bare text / <div> / stray <br> become consistent <p>
  // paragraphs so line spacing is uniform. The normaliser now preserves empty
  // lines as <p><br></p>, so this no longer swallows blank lines the user added.
  const normalizeEditorDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = normalizeRichTextForEditor(el.innerHTML);
    lastSyncRef.current = sanitized;
    if (el.innerHTML !== sanitized) el.innerHTML = sanitized;
    onChange(sanitized);
  }, [onChange]);

  const exec = useCallback(
    (command: string, arg?: string) => {
      const el = editorRef.current;
      if (!el) return;

      // Snapshot the saved range BEFORE focusing: re-focusing the editor (e.g.
      // after the link popover stole focus) fires onFocus, which overwrites
      // savedRangeRef with the collapsed selection. Reading first keeps the
      // user's real selection so createLink wraps the selected text instead of
      // landing at the start.
      const range = savedRangeRef.current;
      el.focus();
      // Only re-apply a *non-collapsed* saved selection. Re-applying a collapsed
      // caret via removeAllRanges()/addRange() resets the browser's pending
      // inline-format state, which would stop Bold/Italic from toggling back
      // OFF at an empty caret. A real selection still gets restored so
      // createLink and friends wrap the originally-selected text.
      if (range && !range.collapsed && el.contains(range.startContainer)) {
        restoreSelection(range);
      }

      document.execCommand(command, false, arg);
      savedRangeRef.current = saveSelection();
      emitChange();
      refreshActiveFormats();
    },
    [emitChange, refreshActiveFormats],
  );

  const insertHtml = useCallback(
    (html: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      // Restore saved range if it's still inside the editor
      const range = savedRangeRef.current;
      if (range && el.contains(range.startContainer)) {
        restoreSelection(range);
      } else {
        // Place cursor at the end if saved range is stale
        const sel = window.getSelection();
        if (sel) {
          sel.selectAllChildren(el);
          sel.collapseToEnd();
        }
      }

      document.execCommand("insertHTML", false, html);
      savedRangeRef.current = saveSelection();
      emitChange();
    },
    [emitChange],
  );

  // Insert a block-level node (figure/iframe) and leave the cursor in a
  // fresh empty paragraph directly after it, so the user can keep typing
  // without ending up inside the figure.
  const insertBlockNode = useCallback(
    (blockHtml: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      // Prefer the range captured at the moment the user clicked the media
      // trigger — the editor's blur handler overwrites savedRangeRef with the
      // (collapsed) selection that exists once focus leaves the editor.
      const range = mediaInsertRangeRef.current ?? savedRangeRef.current;
      mediaInsertRangeRef.current = null;
      pendingMediaInsertRef.current = false;

      if (range && el.contains(range.startContainer)) {
        restoreSelection(range);
      } else {
        const sel = window.getSelection();
        if (sel) {
          sel.selectAllChildren(el);
          sel.collapseToEnd();
        }
      }

      // Sentinel marks the trailing paragraph so we can reliably move
      // the cursor into it after the browser settles the DOM.
      const marker = `rt-cursor-${Date.now()}`;
      document.execCommand(
        "insertHTML",
        false,
        `${blockHtml}<p data-rt-marker="${marker}"><br></p>`,
      );

      const target = el.querySelector(
        `p[data-rt-marker="${marker}"]`,
      ) as HTMLElement | null;
      if (target) {
        target.removeAttribute("data-rt-marker");
        const sel = window.getSelection();
        if (sel) {
          const placement = document.createRange();
          placement.setStart(target, 0);
          placement.collapse(true);
          sel.removeAllRanges();
          sel.addRange(placement);
          savedRangeRef.current = placement.cloneRange();
        }
      } else {
        savedRangeRef.current = saveSelection();
      }

      emitChange();
    },
    [emitChange],
  );

  // Toggle an inline <code> span. With a selection it wraps (or unwraps) the
  // selected text; with a bare caret it either lifts the surrounding code or
  // seeds an empty span to type into. The old handler always dumped a literal
  // "<code>code</code>" placeholder, so selecting text and hitting Code only
  // inserted the word "code" instead of formatting the selection.
  const toggleCode = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const range = savedRangeRef.current;
    if (range && !range.collapsed && el.contains(range.startContainer)) {
      restoreSelection(range);
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Already inside a code span → strip the formatting (unwrap).
    const existing = findEnclosingBlock(sel.anchorNode, el, ["CODE"]);
    if (existing && el.contains(existing)) {
      const parent = existing.parentNode;
      if (parent) {
        const frag = document.createDocumentFragment();
        const first = existing.firstChild;
        while (existing.firstChild) frag.appendChild(existing.firstChild);
        const last = frag.lastChild;
        parent.replaceChild(frag, existing);
        if (first && last) {
          const r = document.createRange();
          r.setStartBefore(first);
          r.setEndAfter(last);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
      savedRangeRef.current = saveSelection();
      emitChange();
      refreshActiveFormats();
      return;
    }

    const active = sel.getRangeAt(0);
    const code = document.createElement("code");

    if (sel.isCollapsed) {
      // Seed a zero-width space so the caret has somewhere to live inside the
      // empty span; it is stripped again by the normaliser on blur/save.
      code.appendChild(document.createTextNode(String.fromCharCode(0x200B)));
      active.insertNode(code);
      const caret = document.createRange();
      caret.setStart(code.firstChild as Node, 1);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    } else {
      // textContent assignment keeps the wrapped value plain — no HTML injection
      // and no nested formatting carried into the code span.
      code.textContent = sel.toString();
      active.deleteContents();
      active.insertNode(code);
      const caret = document.createRange();
      caret.setStartAfter(code);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    }

    savedRangeRef.current = saveSelection();
    emitChange();
    refreshActiveFormats();
  }, [emitChange, refreshActiveFormats]);

  /* ---- toolbar actions ---- */
  const applyBlock = useCallback(
    (tag: "P" | "H2" | "H3" | "H4" | "BLOCKQUOTE") => {
      exec("formatBlock", tag);
      setBlocksOpen(false);
    },
    [exec],
  );

  // Insert a collapsible spoiler. It goes in `open` so its body is editable
  // right away; the normaliser drops the `open` attribute so the stored value
  // renders collapsed. The caret lands in a fresh paragraph after it.
  const insertSpoiler = useCallback(() => {
    const el = editorRef.current;
    // If the caret sits inside an existing spoiler, drop the new one *after*
    // that spoiler rather than nesting one inside another.
    if (el) {
      const sel = window.getSelection();
      const liveRange =
        sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const enclosing =
        liveRange && el.contains(liveRange.startContainer)
          ? findEnclosingBlock(liveRange.startContainer, el, ["DETAILS"])
          : null;
      if (enclosing && sel) {
        const after = document.createRange();
        after.setStartAfter(enclosing);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        savedRangeRef.current = after.cloneRange();
      }
    }
    insertBlockNode(
      `<details open><summary>${ui.spoilerSummary}</summary><p><br></p></details>`,
    );
    setBlocksOpen(false);
  }, [insertBlockNode, ui.spoilerSummary]);

  const insertDivider = useCallback(() => {
    insertBlockNode("<hr>");
    setBlocksOpen(false);
  }, [insertBlockNode]);

  const openPopover = useCallback(
    (kind: PopoverKind) => {
      savedRangeRef.current = saveSelection();
      setPopover(kind);
    },
    [],
  );

  const handleLinkSubmit = useCallback(
    (href: string, text?: string) => {
      if (!/^https?:\/\//i.test(href)) return;
      const el = editorRef.current;
      if (!el) return;

      const range = savedRangeRef.current;
      const hasSelection = !!(
        range &&
        !range.collapsed &&
        el.contains(range.startContainer)
      );
      const selectionText = hasSelection && range ? range.toString().trim() : "";
      const trimmed = (text ?? "").trim();

      // A live selection with no (or unchanged) link text keeps the old
      // behaviour: wrap it via createLink, which preserves any inline formatting
      // inside the selection.
      if (hasSelection && (trimmed === "" || trimmed === selectionText)) {
        exec("createLink", href);
        return;
      }

      // Otherwise drop in a fresh anchor. The typed text becomes the link label;
      // if it's left empty, the URL itself is the label. Any selection is
      // replaced. normalizeRichTextForEditor then forces target/rel + validates
      // the href, so the stored/moderated markup stays safe.
      const visible = trimmed || href;
      insertHtml(`<a href="${escapeHtml(href)}">${escapeHtml(visible)}</a>`);
    },
    [exec, insertHtml],
  );

  // Pasting a whole article should keep its structure — headings as headings,
  // lists as lists — instead of collapsing to plain paragraphs. Order matters:
  //  1. Raw Markdown text FIRST. A .md file, a code editor (VS Code) or a
  //     "source" preview put literal `## …` on BOTH the plain-text and the HTML
  //     clipboard flavour; only the plain text parses cleanly, so whenever the
  //     text carries Markdown syntax we rebuild from it and ignore the HTML.
  //  2. Otherwise, rendered HTML (real <h1>/<h2> tags copied from a rendered
  //     page): the browser's default contentEditable paste tends to flatten
  //     headings to plain text, so we normalise the clipboard HTML ourselves
  //     (which maps <h1>/<h3> → <h2> and strips junk) and insert real blocks.
  // Small inline pastes (a styled word, a bare URL) match neither and keep the
  // browser default, so a fragment is never wrapped in its own paragraph.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;
      const html = clipboard.getData("text/html");
      const text = clipboard.getData("text/plain");

      let clean = "";
      if (text && text.trim() && hasMarkdownSyntax(text)) {
        clean = normalizeRichTextForEditor(markdownToHtml(text));
      } else if (html && html.trim()) {
        const fragment = extractClipboardHtmlFragment(html);
        if (!htmlFragmentHasBlocks(fragment)) return;
        clean = normalizeRichTextForEditor(fragment);
      }

      if (!clean) return;

      e.preventDefault();
      savedRangeRef.current = saveSelection();
      insertHtml(clean);
      // Tidy the DOM into the clean block structure straight away, so pasted
      // headings/lists render properly without waiting for a blur.
      normalizeEditorDom();
    },
    [insertHtml, normalizeEditorDom],
  );

  const handleYouTubeSubmit = useCallback(
    (url: string) => {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) return;
      insertBlockNode(
        `<figure><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></figure>`,
      );
    },
    [insertBlockNode],
  );

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onUploadInlineAsset) {
        e.target.value = "";
        return;
      }
      setUploadingImage(true);
      try {
        const result = await onUploadInlineAsset(file, "image");
        if (result) {
          insertBlockNode(`<figure><img src="${result.url}" alt=""></figure>`);
        }
      } finally {
        e.target.value = "";
        setUploadingImage(false);
      }
    },
    [onUploadInlineAsset, insertBlockNode],
  );

  // A plain Enter inside a quote or heading should drop the caret into a normal
  // paragraph instead of cloning the current block — execCommand("formatBlock")
  // otherwise keeps producing blockquotes/headings line after line. Shift+Enter
  // still inserts a soft <br> for a multi-line quote.
  const exitBlockOnEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const block = findEnclosingBlock(sel.anchorNode, el, [
        "BLOCKQUOTE",
        "H2",
        "H3",
        "H4",
      ]);
      if (!block) return false;

      e.preventDefault();
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      block.parentNode?.insertBefore(paragraph, block.nextSibling);

      const range = document.createRange();
      range.setStart(paragraph, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      emitChange();
      return true;
    },
    [emitChange],
  );

  // A plain Enter while the caret sits inside an inline <code> span should
  // resume in normal text rather than carrying the code formatting onto the
  // next line. We hop the caret just past the code element, then let the
  // browser insert the paragraph break in that (un-styled) context — which
  // also keeps list items intact when code is used inside a list.
  const exitCodeOnEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const code = findEnclosingBlock(sel.anchorNode, el, ["CODE"]);
      if (!code || !el.contains(code)) return false;

      e.preventDefault();
      const after = document.createRange();
      after.setStartAfter(code);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      document.execCommand("insertParagraph");
      savedRangeRef.current = saveSelection();
      emitChange();
      refreshActiveFormats();
      return true;
    },
    [emitChange, refreshActiveFormats],
  );

  // Backspace at the start of an empty trailing list item should drop out of
  // the list into a normal paragraph — mirroring how a plain Enter on an empty
  // item ends the list. Without this only Enter could escape a list.
  const exitListOnBackspace = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key !== "Backspace" ||
        e.shiftKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const li = findEnclosingBlock(sel.anchorNode, el, ["LI"]);
      if (!li || !el.contains(li)) return false;
      const list = li.parentElement;
      if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) return false;

      // Only the last item, and only when empty — a mid-list Backspace should
      // keep its native "merge with the previous item" behaviour.
      if (li.nextElementSibling) return false;
      const zeroWidth = String.fromCharCode(0x200b);
      const isEmpty =
        (li.textContent ?? "").split(zeroWidth).join("").trim() === "" &&
        !li.querySelector("img, iframe, figure");
      if (!isEmpty) return false;

      const parent = list.parentNode;
      if (!parent) return false;

      e.preventDefault();
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      parent.insertBefore(paragraph, list.nextSibling);
      li.remove();
      if (!list.querySelector("li")) list.remove();

      const range = document.createRange();
      range.setStart(paragraph, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      emitChange();
      return true;
    },
    [emitChange],
  );

  // Tab / Shift+Tab inside a list item nests (indents) or un-nests (outdents) it,
  // building the sub-lists browsers otherwise only expose through no visible key.
  // Outside a list Tab keeps its default behaviour (moving focus out of the
  // editor), so keyboard users can still leave the field.
  const handleListTab = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;

      const li = findEnclosingBlock(sel.anchorNode, el, ["LI"]);
      if (!li || !el.contains(li)) return false;

      e.preventDefault();
      exec(e.shiftKey ? "outdent" : "indent");
      return true;
    },
    [exec],
  );

  // Enter on an empty list item ends the list cleanly instead of leaving a blank
  // bullet behind. A nested item pops out one level (so you can carry on in the
  // parent list); a top-level trailing item drops into a fresh paragraph — from
  // where a brand-new list can be started. A non-empty item, or an empty item in
  // the middle of a list, keeps the native "insert the next item" behaviour.
  const exitListOnEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key !== "Enter" ||
        e.shiftKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const li = findEnclosingBlock(sel.anchorNode, el, ["LI"]);
      if (!li || !el.contains(li)) return false;
      const list = li.parentElement;
      if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) {
        return false;
      }

      const zeroWidth = String.fromCharCode(0x200b);
      const isEmpty =
        (li.textContent ?? "").split(zeroWidth).join("").trim() === "" &&
        !li.querySelector("img, iframe, figure");
      if (!isEmpty) return false;

      // A nested empty item: pop it up one level rather than escaping the whole
      // structure, so Enter mirrors Shift+Tab at the end of a sub-list.
      const nested =
        list.parentElement?.tagName === "LI" ||
        list.parentElement?.tagName === "UL" ||
        list.parentElement?.tagName === "OL";
      if (nested) {
        e.preventDefault();
        exec("outdent");
        return true;
      }

      // Top-level list: only the last (trailing) item exits into a paragraph.
      if (li.nextElementSibling) return false;
      const parent = list.parentNode;
      if (!parent) return false;

      e.preventDefault();
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      parent.insertBefore(paragraph, list.nextSibling);
      li.remove();
      if (!list.querySelector("li")) list.remove();

      const range = document.createRange();
      range.setStart(paragraph, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      emitChange();
      return true;
    },
    [emitChange, exec],
  );

  /* ---- spoiler (details/summary) editing ---- */

  // A native <summary> is a focusable disclosure widget: on mousedown it grabs
  // widget focus (and on click it toggles), so the browser never drops an
  // editing caret into the title — which is why clicking it felt dead and only
  // arrow-key navigation reached the text. We cancel both on the summary:
  // mousedown preventDefault stops the focus grab, then we place the caret at
  // the click point ourselves; click preventDefault stops the open/close toggle.
  const handleEditorMouseDown = useCallback((e: React.MouseEvent) => {
    const el = editorRef.current;
    const summary = (e.target as HTMLElement).closest?.("summary");
    if (!el || !summary || !el.contains(summary)) return;

    e.preventDefault();
    el.focus();

    const sel = window.getSelection();
    if (!sel) return;

    let range: Range | null = null;
    const docWithCaret = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    if (typeof document.caretRangeFromPoint === "function") {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (typeof docWithCaret.caretPositionFromPoint === "function") {
      const pos = docWithCaret.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    // Fall back to the end of the summary when the point can't be resolved.
    if (!range || !summary.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(summary);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
    refreshActiveFormats();
  }, [refreshActiveFormats]);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    // Cancel the disclosure toggle so clicking the title never collapses the
    // spoiler (the caret was already placed on mousedown).
    if ((e.target as HTMLElement).closest?.("summary")) {
      e.preventDefault();
    }
  }, []);

  // Enter in a spoiler: from the title jump into the body; from an empty
  // trailing body line drop out of the spoiler into a normal paragraph. Stops
  // Enter from cloning the summary or spawning nested spoilers.
  const handleSpoilerEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const details = findEnclosingBlock(sel.anchorNode, el, ["DETAILS"]);
      if (!details || !el.contains(details)) return false;

      const summary = findEnclosingBlock(sel.anchorNode, el, ["SUMMARY"]);
      if (summary) {
        e.preventDefault();
        let body = summary.nextElementSibling as HTMLElement | null;
        if (!body) {
          body = document.createElement("p");
          body.appendChild(document.createElement("br"));
          details.appendChild(body);
        }
        const range = document.createRange();
        range.setStart(body, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
        emitChange();
        return true;
      }

      const block = findEnclosingBlock(sel.anchorNode, el, [
        "P",
        "H2",
        "H3",
        "H4",
        "BLOCKQUOTE",
      ]);
      if (!block) return false;
      const zeroWidth = String.fromCharCode(0x200b);
      const isEmpty =
        (block.textContent ?? "").split(zeroWidth).join("").trim() === "";
      if (!isEmpty || block.nextElementSibling) return false;

      e.preventDefault();
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      details.parentNode?.insertBefore(paragraph, details.nextSibling);
      block.remove();
      const range = document.createRange();
      range.setStart(paragraph, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      emitChange();
      return true;
    },
    [emitChange],
  );

  // Backspace at the very start of a spoiler title: block the native merge that
  // would corrupt the structure. When the title is already empty, dissolve the
  // whole spoiler back into normal paragraphs so it is never a dead end.
  const handleSpoilerBackspace = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key !== "Backspace" ||
        e.shiftKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return false;
      }
      const el = editorRef.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

      const summary = findEnclosingBlock(sel.anchorNode, el, ["SUMMARY"]);
      if (!summary || !el.contains(summary)) return false;

      const probe = document.createRange();
      probe.selectNodeContents(summary);
      probe.setEnd(sel.anchorNode as Node, sel.anchorOffset);
      if (probe.toString().length > 0) return false; // not at the start

      e.preventDefault();

      const zeroWidth = String.fromCharCode(0x200b);
      const titleEmpty =
        (summary.textContent ?? "").split(zeroWidth).join("").trim() === "";
      if (!titleEmpty) return true; // guard the structure, keep the title

      const details = summary.parentElement;
      if (!details) return true;

      const frag = document.createDocumentFragment();
      let firstBody: HTMLElement | null = null;
      for (const child of Array.from(details.children)) {
        if (child === summary) continue;
        if (!firstBody) firstBody = child as HTMLElement;
        frag.appendChild(child);
      }
      if (!firstBody) {
        const p = document.createElement("p");
        p.appendChild(document.createElement("br"));
        frag.appendChild(p);
        firstBody = p;
      }
      details.replaceWith(frag);

      const range = document.createRange();
      range.setStart(firstBody, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      emitChange();
      return true;
    },
    [emitChange],
  );

  /* ---- keyboard shortcuts ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (handleListTab(e)) return;
      if (handleSpoilerEnter(e)) return;
      if (handleSpoilerBackspace(e)) return;
      if (exitCodeOnEnter(e)) return;
      if (exitListOnEnter(e)) return;
      if (exitBlockOnEnter(e)) return;
      if (exitListOnBackspace(e)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      switch (e.key.toLowerCase()) {
        case "b":
          if (!features.bold) break;
          e.preventDefault();
          exec("bold");
          break;
        case "i":
          if (!features.italic) break;
          e.preventDefault();
          exec("italic");
          break;
        case "k":
          if (!features.link) break;
          e.preventDefault();
          openPopover("link");
          break;
      }
    },
    [
      exec,
      openPopover,
      exitBlockOnEnter,
      exitCodeOnEnter,
      exitListOnBackspace,
      exitListOnEnter,
      handleListTab,
      handleSpoilerEnter,
      handleSpoilerBackspace,
      features,
    ],
  );

  /* ---- emoji picker ---- */
  const handleEmojiSelect = useCallback(
    (emoji: { native: string }) => {
      insertHtml(emoji.native);
      setEmojiOpen(false);
    },
    [insertHtml],
  );

  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (emojiRef.current?.contains(e.target)) return;
      setEmojiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  // Lazy-load the emoji dataset the first time the picker is opened.
  useEffect(() => {
    if (!emojiOpen || emojiAssets) return;
    let cancelled = false;
    void loadEmojiAssets().then((assets) => {
      if (!cancelled) setEmojiAssets(assets);
    });
    return () => {
      cancelled = true;
    };
  }, [emojiOpen, emojiAssets]);

  /* ---- selection tracking ---- */
  const trackSelection = useCallback(() => {
    savedRangeRef.current = saveSelection();
    refreshActiveFormats();
  }, [refreshActiveFormats]);

  const editorPlainText = extractPlainTextFromRichText(value);
  // Treat the editor as non-empty also when it embeds media (images, video, YouTube),
  // otherwise the placeholder keeps overlapping the inserted block.
  const hasEmbeddedMedia = /<(?:img|iframe|video|figure|hr|details)\b/i.test(value);
  const isEmpty = editorPlainText.length === 0 && !hasEmbeddedMedia;

  /* ---- prevent default on toolbar mousedown to not steal focus ---- */
  const pd = (e: React.MouseEvent) => e.preventDefault();

  // Which toolbar clusters the active feature set renders — drives the
  // separators so a trimmed toolbar never shows a dangling divider.
  const hasBlocksMenu = features.blocks || features.lists;
  const hasInlineTools =
    features.bold ||
    features.italic ||
    features.link ||
    features.emoji ||
    features.code;

  return (
    <div className="space-y-3">
      {/* Label / hint / counter */}
      {(label || hint || maxLength) && (
        <div className="space-y-1">
          {/* Label and counter share one row; both are short so they fit even
              on narrow phones. The hint always spans the full width below, so
              it never gets squeezed into a second column. */}
          {(label || typeof maxLength === "number") && (
            <div className="flex items-start gap-3">
              {label && (
                <p className="min-w-0 text-sm font-semibold text-[color:var(--foreground)]">
                  {label}
                </p>
              )}
              {typeof maxLength === "number" && (
                <span className="ml-auto shrink-0 whitespace-nowrap pt-0.5 text-xs tabular-nums app-soft">
                  {editorPlainText.length} / {maxLength} {ui.chars}
                </span>
              )}
            </div>
          )}
          {hint && <p className="text-sm app-muted">{hint}</p>}
        </div>
      )}

      <div
        className={cls(
          "rounded-panel border app-border bg-[color:var(--surface)] shadow-[0_22px_90px_rgba(2,6,23,0.18)]",
          // `overflow-hidden` clips children to the rounded corners, but it also
          // breaks `position: sticky` for the toolbar — so we drop it when the
          // toolbar needs to pin and round the toolbar's top corners instead.
          stickyToolbar ? "" : "overflow-hidden",
        )}
      >
        {/* -------- Toolbar -------- */}
        <div
          className={cls(
            "relative border-b app-border px-3 py-2",
            stickyToolbar
              ? "sticky top-20 z-30 rounded-t-panel bg-[color:var(--surface-muted)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface-muted)]/80"
              : "bg-[color:var(--surface-muted)]/55",
          )}
        >
          <div className="flex flex-wrap items-center gap-1">
            {/* + Block menu */}
            {hasBlocksMenu && (
              <div className="relative" ref={blocksMenuRef}>
                <button
                  type="button"
                  className={cls(btnBase, blocksOpen ? btnActive : btnIdle)}
                  onMouseDown={pd}
                  onClick={() => setBlocksOpen((v) => !v)}
                >
                  <span className="text-base leading-none">+</span>
                </button>

                {blocksOpen && (
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-2xl border app-border bg-[color:var(--surface)] p-2.5 shadow-2xl">
                    {features.blocks && (
                      <>
                        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider app-soft">
                          {ui.structureTitle}
                        </p>
                        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => applyBlock("P")}>
                          <span className="w-6 text-center text-base text-[color:var(--muted-foreground)]">¶</span>
                          {ui.paragraph}
                        </button>
                        {features.headings && (
                          <>
                            <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => applyBlock("H2")}>
                              <span className="w-6 text-center text-sm font-bold text-[color:var(--muted-foreground)]">H2</span>
                              {ui.heading}
                            </button>
                            <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => applyBlock("H3")}>
                              <span className="w-6 text-center text-xs font-bold text-[color:var(--muted-foreground)]">H3</span>
                              {ui.heading3}
                            </button>
                            <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => applyBlock("H4")}>
                              <span className="w-6 text-center text-[0.65rem] font-bold text-[color:var(--muted-foreground)]">H4</span>
                              {ui.heading4}
                            </button>
                          </>
                        )}
                        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => applyBlock("BLOCKQUOTE")}>
                          <span className="w-6 text-center text-base text-[color:var(--muted-foreground)]">&#10077;</span>
                          {ui.quote}
                        </button>

                        <div className="my-2 border-t app-border" />

                        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider app-soft">
                          {ui.insertTitle}
                        </p>
                        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={insertSpoiler}>
                          <span className="w-6 text-center text-base text-[color:var(--muted-foreground)]">▸</span>
                          {ui.spoiler}
                        </button>
                        {features.divider && (
                          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={insertDivider}>
                            <span className="w-6 text-center text-base text-[color:var(--muted-foreground)]">—</span>
                            {ui.divider}
                          </button>
                        )}
                      </>
                    )}

                    {features.blocks && features.lists && (
                      <div className="my-2 border-t app-border" />
                    )}

                    {features.lists && (
                      <>
                        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider app-soft">
                          {ui.listTitle}
                        </p>
                        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => { exec("insertUnorderedList"); setBlocksOpen(false); }}>
                          <span className="w-6 text-center text-lg leading-none text-[color:var(--muted-foreground)]">•</span>
                          {ui.ul}
                        </button>
                        <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]" onMouseDown={pd} onClick={() => { exec("insertOrderedList"); setBlocksOpen(false); }}>
                          <span className="w-6 text-center text-sm font-bold text-[color:var(--muted-foreground)]">1.</span>
                          {ui.ol}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {hasBlocksMenu && hasInlineTools && (
              <div className="mx-0.5 h-5 w-px bg-[color:var(--border)]" />
            )}

            {/* Bold */}
            {features.bold && (
            <button type="button" className={cls(btnBase, activeFormats.bold ? btnActive : btnIdle)} onMouseDown={pd} onClick={() => exec("bold")} title={ui.bold}>
              <span className="text-sm font-bold">B</span>
            </button>
            )}

            {/* Italic */}
            {features.italic && (
            <button type="button" className={cls(btnBase, activeFormats.italic ? btnActive : btnIdle)} onMouseDown={pd} onClick={() => exec("italic")} title={ui.italic}>
              <span className="text-sm italic">I</span>
            </button>
            )}

            {/* Link */}
            {features.link && (
            <button type="button" className={cls(btnBase, popover === "link" ? btnActive : btnIdle)} onMouseDown={pd} onClick={() => openPopover(popover === "link" ? null : "link")} title={ui.link}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
              </svg>
            </button>
            )}

            {/* Emoji */}
            {features.emoji && (
            <div className="relative" ref={emojiRef}>
              <button type="button" className={cls(btnBase, emojiOpen ? btnActive : btnIdle)} onMouseDown={pd} onClick={() => { savedRangeRef.current = saveSelection(); setEmojiOpen((v) => !v); }} title={ui.emoji}>
                <span className="text-sm">😊</span>
              </button>
              {emojiOpen && emojiAssets && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30">
                  <EmojiPicker
                    data={emojiAssets.data}
                    i18n={isUk ? emojiAssets.i18nUk : emojiAssets.i18nEn}
                    locale={isUk ? "uk" : "en"}
                    theme="dark"
                    previewPosition="none"
                    skinTonePosition="search"
                    onEmojiSelect={handleEmojiSelect}
                  />
                </div>
              )}
            </div>
            )}

            {/* Code */}
            {features.code && (
            <button type="button" className={cls(btnBase, activeFormats.code ? btnActive : btnIdle)} onMouseDown={pd} onClick={toggleCode} title={ui.code}>
              <span className="font-mono text-xs font-semibold">&lt;/&gt;</span>
            </button>
            )}

            {/* Media separator */}
            {(onUploadInlineAsset || showYouTube) && (hasBlocksMenu || hasInlineTools) && (
              <div className="mx-0.5 h-5 w-px bg-[color:var(--border)]" />
            )}

            {/* Image upload */}
            {onUploadInlineAsset && (
              <>
                <label
                  htmlFor={imageInputId}
                  className={cls(btnBase, btnIdle, "cursor-pointer")}
                  title={ui.image}
                  onMouseDown={() => {
                    // Capture the cursor position *before* focus shifts to the
                    // hidden file input. Without this, the editor's blur
                    // handler may run normalizeEditorDom which rewrites the
                    // innerHTML and invalidates savedRangeRef's nodes — then
                    // the image would land at the beginning of the editor.
                    mediaInsertRangeRef.current = saveSelection();
                    pendingMediaInsertRef.current = true;
                  }}
                >
                  <span className="text-xs font-semibold">
                    {uploadingImage ? ui.uploading : "IMG"}
                  </span>
                </label>
                <input
                  id={imageInputId}
                  type="file"
                  accept="image/*,image/gif"
                  className="sr-only"
                  onChange={(e) => void handleImageUpload(e)}
                />
              </>
            )}

            {/* YouTube */}
            {showYouTube && (
              <button
                type="button"
                className={cls(
                  btnBase,
                  popover === "youtube" ? btnActive : btnIdle,
                )}
                onMouseDown={pd}
                onClick={() =>
                  openPopover(popover === "youtube" ? null : "youtube")
                }
                title={ui.youtube}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.515a1.75 1.75 0 0 1-1.75 1.75H2.75A1.75 1.75 0 0 1 1 15.265V4.75Zm12.3 5.68-4.5-2.9A.75.75 0 0 0 7.65 8.2v5.6a.75.75 0 0 0 1.15.63l4.5-2.9a.75.75 0 0 0 0-1.22v-.03Z" />
                </svg>
              </button>
            )}

            {toolbarSuffix && <div className="ml-auto">{toolbarSuffix}</div>}
          </div>

          {/* Inline popover */}
          {popover && (
            <InlinePopover
              kind={popover}
              locale={locale}
              initialText={
                popover === "link"
                  ? (savedRangeRef.current?.toString() ?? "")
                  : ""
              }
              onSubmit={
                popover === "link" ? handleLinkSubmit : handleYouTubeSubmit
              }
              onClose={() => setPopover(null)}
            />
          )}
        </div>

        {/* -------- Editor area -------- */}
        <div className="relative">
          {isEmpty && (
            <div className="pointer-events-none absolute inset-x-5 top-5 text-[color:var(--muted-foreground)]">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className={cls(
              "rich-text-editor min-h-48 px-5 py-5 text-[color:var(--foreground)] outline-none",
              contentClassName,
            )}
            style={{ minHeight }}
            onFocus={() => {
              const el = editorRef.current;
              // Begin typing inside a real <p> so Enter consistently produces
              // new paragraphs. With no block to start in, the browser drops the
              // first characters into a bare text node and then mixes <div>/<br>
              // on Enter — the source of the uneven line spacing.
              if (el && el.childNodes.length === 0) {
                el.innerHTML = "<p><br></p>";
                const first = el.firstElementChild;
                if (first) {
                  const range = document.createRange();
                  range.setStart(first, 0);
                  range.collapse(true);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }
              }
              savedRangeRef.current = saveSelection();
              document.execCommand("defaultParagraphSeparator", false, "p");
            }}
            onBlur={() => {
              // When focus moves into a popover / emoji picker / upload control,
              // the editor selection collapses. Don't overwrite the range those
              // flows saved on open (openPopover) — a pending createLink would
              // otherwise target the collapsed selection and land at the start
              // instead of wrapping the selected text. Normalizing the DOM here
              // would likewise invalidate the saved cursor position.
              if (
                popover ||
                uploadingImage ||
                emojiOpen ||
                pendingMediaInsertRef.current
              ) {
                return;
              }
              savedRangeRef.current = saveSelection();
              normalizeEditorDom();
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={trackSelection}
            onPaste={handlePaste}
            onMouseDown={handleEditorMouseDown}
            onClick={handleEditorClick}
            onMouseUp={trackSelection}
            onInput={() => {
              trackSelection();
              emitChange();
            }}
          />
        </div>
      </div>
    </div>
  );
}
