export function parsePython(code) {
  const functions = [];
  const lines = code.split(/\r?\n/);
  const indentStack = [0]; // track indentation depths
  let pendingDecorators = [];
  let pendingDoc = null;

  function getIndent(line) {
    return line.search(/\S/);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = getIndent(line);
    const trimmed = line.trim();

    // Multiline docstring tracking (""")
    if (pendingDoc !== null) {
      // we are inside a function docstring; accumulate until closing """
      pendingDoc += (pendingDoc ? '\n' : '') + trimmed;
      if (trimmed.endsWith('"""')) {
        // done – but we only set the docstring on the function object later (already attached)
        // For simplicity, we attach docstring to the last function if it lacks one.
        if (pendingDocTarget !== null && !functions[pendingDocTarget].docstring) {
            functions[pendingDocTarget].docstring = pendingDoc;
            }
            pendingDoc = null;
            pendingDocTarget = null;
      }
      continue;
    }

    // Decorator detection
    if (trimmed.startsWith('@')) {
      pendingDecorators.push(trimmed);
      continue;
    }

    // Function detection: def / async def
      const defMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->[^:]+)?\s*:/);    if (defMatch) {
      const name = defMatch[1];
      const params = defMatch[2].trim();
      const isAsync = /\basync\b/.test(trimmed);
      const lineNumber = i + 1;

      // Create function object
      const funcObj = {
        name,
        params,
        isAsync,
        isExported: false,  // Python has no export keyword; can check if __all__ or not but skip
        isArrow: false,
        docstring: null,
        lineNumber
      };

      // If we have pending decorators, attach them as a comment? Not required; we'll ignore.
      // Check for immediate docstring on next lines (indented triple quotes)
      // Look ahead for a docstring inside the function body
      let j = i + 1;
      let foundDoc = null;
      while (j < lines.length && (lines[j].trim() === '' || getIndent(lines[j]) > indent)) {
        if (lines[j].trim().startsWith('"""') || lines[j].trim().startsWith("'''")) {
          foundDoc = lines[j].trim();
          // If it's a one-line docstring
          if (foundDoc.endsWith('"""') || foundDoc.endsWith("'''")) {
            funcObj.docstring = foundDoc;
          } else {
            // Multi-line: start accumulation
            pendingDoc = foundDoc;
            pendingDocTarget = functions.length;
          }
          break;
        }
        j++;
      }
      if (!funcObj.docstring && foundDoc) {
        // if we set pendingDoc, the doc will be filled later
        funcObj.docstring = null; // will be overwritten later
      }

      functions.push(funcObj);
      pendingDecorators = [];
      continue;
    }

    // Not a function – clear decorators and docstring
    pendingDecorators = [];
    pendingDoc = null; // safety
  }

  return functions;
}