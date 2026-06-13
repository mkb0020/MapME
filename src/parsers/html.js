import { parseJavaScript } from './javascript.js';

export function parseHtml(code) {
  const functions = [];
  // Extract all <script> blocks (ignore type, handle both inline and src? only inline)
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let blockIndex = 0;
  while ((match = scriptRegex.exec(code)) !== null) {
    blockIndex++;
    const scriptContent = match[1];
    if (scriptContent.trim().length === 0) continue;
    const jsFunctions = parseJavaScript(scriptContent);
    // Tag each function with the script block
    jsFunctions.forEach(fn => {
      fn.name = `[Script Block ${blockIndex}] ${fn.name}`;
    });
    functions.push(...jsFunctions);
  }
  return functions;
}