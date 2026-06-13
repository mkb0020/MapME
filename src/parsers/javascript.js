export function parseJavaScript(code) {
  const functions = [];
  const lines     = code.split(/\r?\n/);

  // — State —
  let currentClass    = null;   // class name we're inside, or null
  let classBraceDepth = 0;      // brace depth INSIDE the class body
  let pendingDoc      = null;   // accumulated JSDoc string

  // Strip /** ... */ delimiters and leading * from each line
  function cleanDoc(raw) {
    if (!raw) return null;
    return raw
      .replace(/^\/\*\*\s*/, '')
      .replace(/\s*\*\/$/, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    // ── JSDoc accumulation (single or multi-line) ─────────────────────────────
    if (trimmed.startsWith('/**')) {
      pendingDoc = trimmed;
      if (!trimmed.endsWith('*/')) {
        while (i + 1 < lines.length) {
          i++;
          pendingDoc += '\n' + lines[i].trim();
          if (lines[i].trim().endsWith('*/')) break;
        }
      }
      continue;
    }

    // ── Class detection ───────────────────────────────────────────────────────
    const classMatch = trimmed.match(/(?:export\s+(?:default\s+)?)?class\s+([\w$]+)/);
    if (classMatch && !currentClass) {
      const isExported = /\bexport\b/.test(trimmed);
      functions.push({
        name:       classMatch[1],
        params:     '',
        isAsync:    false,
        isExported,
        isArrow:    false,
        isClass:    true,
        docstring:  cleanDoc(pendingDoc),
        lineNumber: i + 1,
      });
      pendingDoc      = null;
      currentClass    = classMatch[1];
      classBraceDepth = 0;
      // Count any braces on this same line to start depth correctly
      for (const ch of line) {
        if (ch === '{') classBraceDepth++;
        else if (ch === '}') classBraceDepth--;
      }
      continue;
    }

    // ── Inside a class ────────────────────────────────────────────────────────
    if (currentClass) {
      // Count braces BEFORE trying to match methods so depth reflects this line
      for (const ch of line) {
        if (ch === '{') classBraceDepth++;
        else if (ch === '}') classBraceDepth--;
      }

      // Exited the class body
      if (classBraceDepth <= 0) {
        currentClass    = null;
        classBraceDepth = 0;
        pendingDoc      = null;
        continue;
      }

      // constructor
      const ctorMatch = trimmed.match(/^constructor\s*\(([^)]*)\)/);
      if (ctorMatch) {
        functions.push({
          name:        `${currentClass}.constructor`,
          params:      ctorMatch[1].trim(),
          isAsync:     false,
          isExported:  false,
          isArrow:     false,
          isClass:     false,
          isConstructor: true,
          docstring:   cleanDoc(pendingDoc),
          lineNumber:  i + 1,
        });
        pendingDoc = null;
        continue;
      }

      // Regular / async method — matches lines like:
      //   methodName(params) {
      //   async methodName(params) {
      //   static methodName(params) {
      //   static async methodName(params) {
      const methodMatch = trimmed.match(
        /^(?:static\s+)?(?:async\s+)?([\w$]+)\s*\(([^)]*)\)\s*\{/
      );
      if (methodMatch && methodMatch[1] !== 'constructor') {
        const isAsync = /\basync\b/.test(trimmed);
        functions.push({
          name:       `${currentClass}.${methodMatch[1]}`,
          params:     methodMatch[2].trim(),
          isAsync,
          isExported: false,
          isArrow:    false,
          isClass:    false,
          docstring:  cleanDoc(pendingDoc),
          lineNumber: i + 1,
        });
        pendingDoc = null;
      } else if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        // Non-function line inside class — reset doc
        pendingDoc = null;
      }
      continue;
    }

    // ── Export default function ───────────────────────────────────────────────
    const defaultExport = trimmed.match(
      /export\s+default\s+(?:async\s+)?function(?:\s+([\w$]+))?\s*\(([^)]*)\)/
    );
    if (defaultExport) {
      functions.push({
        name:       defaultExport[1] || 'default',
        params:     defaultExport[2].trim(),
        isAsync:    /\basync\b/.test(trimmed),
        isExported: true,
        isArrow:    false,
        isClass:    false,
        docstring:  cleanDoc(pendingDoc),
        lineNumber: i + 1,
      });
      pendingDoc = null;
      continue;
    }

    // ── Top-level named function ──────────────────────────────────────────────
    const funcMatch = trimmed.match(
      /(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)/
    );
    if (funcMatch) {
      functions.push({
        name:       funcMatch[1],
        params:     funcMatch[2].trim(),
        isAsync:    /\basync\b/.test(trimmed),
        isExported: /\bexport\b/.test(trimmed),
        isArrow:    false,
        isClass:    false,
        docstring:  cleanDoc(pendingDoc),
        lineNumber: i + 1,
      });
      pendingDoc = null;
      continue;
    }

    // ── Arrow function: const/let/var name = (params) => ─────────────────────
    const arrowParens = trimmed.match(
      /(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/
    );
    if (arrowParens) {
      functions.push({
        name:       arrowParens[1],
        params:     arrowParens[2].trim(),
        isAsync:    /\basync\b/.test(trimmed),
        isExported: /\bexport\b/.test(trimmed),
        isArrow:    true,
        isClass:    false,
        docstring:  cleanDoc(pendingDoc),
        lineNumber: i + 1,
      });
      pendingDoc = null;
      continue;
    }

    // ── Arrow function: const/let/var name = param => (single param, no parens)
    const arrowSingle = trimmed.match(
      /(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?([\w$]+)\s*=>/
    );
    if (arrowSingle) {
      functions.push({
        name:       arrowSingle[1],
        params:     arrowSingle[2].trim(),
        isAsync:    /\basync\b/.test(trimmed),
        isExported: /\bexport\b/.test(trimmed),
        isArrow:    true,
        isClass:    false,
        docstring:  cleanDoc(pendingDoc),
        lineNumber: i + 1,
      });
      pendingDoc = null;
      continue;
    }

    // ── No match — reset pending doc on non-empty, non-comment lines ──────────
    if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      pendingDoc = null;
    }
  }

  return functions;
}