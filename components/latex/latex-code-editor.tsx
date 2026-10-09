"use client";

import React, { useEffect, useRef } from "react";
import { EditorState, Compartment, StateEffect, StateField, RangeSet } from "@codemirror/state";
import { EditorView, keymap, ViewUpdate, Decoration } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { latex } from "codemirror-lang-latex";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export interface LatexCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  fileId: string;
  readOnly?: boolean;
  isWrapLines?: boolean;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  targetLine?: number | null;
  highlightRange?: { startLine: number; endLine: number } | null;
}

const setHighlight = StateEffect.define<{ startLine: number; endLine: number } | null>();
const highlightField = StateField.define<RangeSet<Decoration>>({
  create: () => RangeSet.empty,
  update: (decorations, transaction) => {
    let next = transaction.docChanged ? decorations.map(transaction.changes) : decorations;
    for (const effect of transaction.effects) {
      if (effect.is(setHighlight)) {
        next = effect.value
          ? createLineDecorations(transaction.state, effect.value.startLine, effect.value.endLine)
          : RangeSet.empty;
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const changedLineMark = Decoration.line({ attributes: { class: "cm-ai-changed-line" } });

function createLineDecorations(
  state: EditorState,
  startLine: number,
  endLine: number
): RangeSet<Decoration> {
  const safeStart = Math.max(1, Math.min(startLine, state.doc.lines));
  const safeEnd = Math.max(safeStart, Math.min(endLine, state.doc.lines));
  const ranges = [];
  for (let lineNumber = safeStart; lineNumber <= safeEnd; lineNumber += 1) {
    ranges.push(changedLineMark.range(state.doc.line(lineNumber).from));
  }
  return RangeSet.of(ranges, true);
}

/**
 * Premium dark luxury theme matching the RESUME.ENG palette.
 */
const darkResumeTheme = EditorView.theme(
  {
    "&": {
      color: "#E2E8F0",
      backgroundColor: "#070709",
      height: "100%",
      fontSize: "12px",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    ".cm-ai-changed-line": {
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      borderLeft: "2px solid rgba(245, 158, 11, 0.8)",
    },
    ".cm-content": {
      caretColor: "#F59E0B",
      padding: "12px 16px",
      lineHeight: "1.5rem",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#F59E0B",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(245, 158, 11, 0.2) !important",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      outline: "1px solid rgba(255, 255, 255, 0.15)",
    },
    ".cm-gutters": {
      backgroundColor: "#070709",
      color: "#52525B",
      borderRight: "1px solid rgba(255, 255, 255, 0.04)",
      paddingTop: "12px",
      paddingBottom: "12px",
      userSelect: "none",
    },
    ".cm-gutterElement": {
      padding: "0 10px 0 12px",
      minWidth: "38px",
      textAlign: "right",
      lineHeight: "1.5rem",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#D4D4D8",
      fontWeight: "600",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(245, 158, 11, 0.15)",
      outline: "1px solid rgba(245, 158, 11, 0.4)",
      borderRadius: "2px",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      outline: "1px solid rgba(239, 68, 68, 0.5)",
      borderRadius: "2px",
    },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0 4px",
      color: "#52525B",
      cursor: "pointer",
    },
    ".cm-foldGutter .cm-gutterElement:hover": {
      color: "#E2E8F0",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
    },
    ".cm-tooltip": {
      backgroundColor: "#0F0F14",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#E2E8F0",
      borderRadius: "4px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li": {
        padding: "3px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(245, 158, 11, 0.15)",
        color: "#F59E0B",
      },
    },
  },
  { dark: true }
);

/**
 * Restrained, high-contrast dark luxury syntax highlighter for LaTeX.
 */
const latexHighlightStyle = HighlightStyle.define([
  // LaTeX commands: \documentclass, \usepackage, \begin, \end, \section, \textbf, etc.
  { tag: tags.keyword, color: "#93C5FD", fontWeight: "500" },
  { tag: tags.macroName, color: "#93C5FD" },
  { tag: tags.definition(tags.variableName), color: "#60A5FA" },
  // Comments: % ...
  { tag: tags.comment, color: "#64748B", fontStyle: "italic" },
  // Environment and class names: {article}, {document}, {itemize}, etc.
  { tag: tags.typeName, color: "#FDE047" },
  { tag: tags.standard(tags.typeName), color: "#FDE047" },
  // Strings and URLs: \href{...}{...}
  { tag: tags.string, color: "#86EFAC" },
  { tag: tags.url, color: "#38BDF8", textDecoration: "underline" },
  // Brackets, braces, punctuation: {}, [], \
  { tag: tags.bracket, color: "#94A3B8" },
  { tag: tags.punctuation, color: "#94A3B8" },
  // Special characters & math
  { tag: tags.special(tags.variableName), color: "#F472B6" },
  { tag: tags.number, color: "#FCD34D" },
  { tag: tags.atom, color: "#C084FC" },
]);

export function LatexCodeEditor({
  value,
  onChange,
  fileId,
  readOnly = false,
  isWrapLines = false,
  onCursorChange,
  onSave,
  targetLine,
  highlightRange = null,
}: LatexCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Compartments for dynamic reconfiguration without full editor recreation
  const wrapCompartmentRef = useRef<Compartment>(new Compartment());
  const readOnlyCompartmentRef = useRef<Compartment>(new Compartment());

  // Store latest callbacks and props in refs to avoid stale closures in listeners
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Track the fileId currently rendered in the editor to detect file switches
  const currentFileIdRef = useRef(fileId);

  // Flag to suppress echo onChange calls when updating editor from external props
  const isDispatchingExternalUpdateRef = useRef(false);

  // Initialize CodeMirror instance once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const wrapComp = wrapCompartmentRef.current;
    const readOnlyComp = readOnlyCompartmentRef.current;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      // 1. Notify parent of content changes caused by user typing
      if (update.docChanged && !isDispatchingExternalUpdateRef.current) {
        const newDoc = update.state.doc.toString();
        onChangeRef.current(newDoc);
      }

      // 2. Notify parent of cursor line/col movement
      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        const lineNum = line.number;
        const colNum = head - line.from + 1;
        onCursorChangeRef.current?.(lineNum, colNum);
      }
    });

    // Custom keymap: intercept Cmd+S / Ctrl+S to trigger manual save
    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current?.();
          return true; // prevent default browser save dialog
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        latex({ autoCloseTags: true, enableAutocomplete: true }),
        darkResumeTheme,
        syntaxHighlighting(latexHighlightStyle),
        highlightField,
        wrapComp.of(isWrapLines ? EditorView.lineWrapping : []),
        readOnlyComp.of(EditorState.readOnly.of(readOnly)),
        saveKeymap,
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    currentFileIdRef.current = fileId;

    // Report initial cursor position
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    onCursorChangeRef.current?.(line.number, head - line.from + 1);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount

  // Handle external value or fileId changes safely without recreation
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isDifferentFile = currentFileIdRef.current !== fileId;
    const currentDoc = view.state.doc.toString();

    if (isDifferentFile || currentDoc !== value) {
      currentFileIdRef.current = fileId;
      isDispatchingExternalUpdateRef.current = true;
      try {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
          // When switching files, reset cursor to line 1 col 1
          selection: isDifferentFile ? { anchor: 0 } : undefined,
        });
      } finally {
        isDispatchingExternalUpdateRef.current = false;
      }
    }
  }, [value, fileId]);

  // Handle wrap toggle dynamically via compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(
        isWrapLines ? EditorView.lineWrapping : []
      ),
    });
  }, [isWrapLines]);

  // Handle readOnly toggle dynamically via compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    });
  }, [readOnly]);

  // Handle jump to specific error line when requested
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !targetLine || targetLine <= 0) return;

    try {
      const lineCount = view.state.doc.lines;
      const safeLine = Math.min(targetLine, lineCount);
      const lineObj = view.state.doc.line(safeLine);
      view.dispatch({
        selection: { anchor: lineObj.from },
        scrollIntoView: true,
      });
      view.focus();
    } catch {
      // ignore
    }
  }, [targetLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setHighlight.of(highlightRange) });
    if (!highlightRange) return;
    const safeLine = Math.max(1, Math.min(highlightRange.startLine, view.state.doc.lines));
    const line = view.state.doc.line(safeLine);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
    const timer = window.setTimeout(() => {
      if (viewRef.current === view) view.dispatch({ effects: setHighlight.of(null) });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [highlightRange]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-w-0 flex-1 overflow-hidden"
    />
  );
}
