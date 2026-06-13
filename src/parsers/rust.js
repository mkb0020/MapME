export function parseRust(code) {
  const functions = [];
  const lines = code.split(/\r?\n/);
  let pendingDocLines = [];
  let currentImpl = null;
  let braceDepth = 0;
  let implStartDepth = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track brace depth for impl block exit detection
    braceDepth += (trimmed.match(/\{/g) || []).length;
    braceDepth -= (trimmed.match(/\}/g) || []).length;

    // Exit impl block when we return to the depth it opened at
    if (currentImpl !== null && braceDepth < implStartDepth) {
      currentImpl = null;
      implStartDepth = null;
    }

    // /// doc comments
    if (trimmed.startsWith('///')) {
      pendingDocLines.push(trimmed.replace(/^\/\/\/\s*/, ''));
      continue;
    }

    // Blank lines — preserve pending docs (doc comment may be separated from fn by a blank line)
    if (trimmed === '') continue;

    // impl block entry — capture struct name and depth
    const implMatch = trimmed.match(/^impl(?:<[^>]*>)?\s+(\w+)/);
    if (implMatch) {
      currentImpl = implMatch[1];
      implStartDepth = braceDepth;
      pendingDocLines = [];
      continue;
    }

    // Match fn definitions: pub? pub(crate)? async? fn name(params) -> ReturnType?
    const fnMatch = trimmed.match(
      /^(?:pub(?:\s*\(\s*\w+\s*\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^{;]+))?/
    );

    if (fnMatch) {
      const name      = currentImpl ? `${currentImpl}::${fnMatch[1]}` : fnMatch[1];
      const params    = fnMatch[2].trim();
      const returnType = fnMatch[3] ? fnMatch[3].trim() : null;
      const isAsync   = /\basync\b/.test(trimmed);
      const isExported = /\bpub\b/.test(trimmed);
      const docstring = pendingDocLines.length > 0 ? pendingDocLines.join('\n') : null;

      functions.push({
        name,
        params,
        returnType,
        isAsync,
        isExported,
        isArrow: false,
        docstring,
        lineNumber: i + 1,
      });

      pendingDocLines = [];
      continue;
    }

    // Non-doc, non-blank, non-fn line — reset pending docs
    if (!trimmed.startsWith('///')) {
      pendingDocLines = [];
    }
  }

  return functions;
}