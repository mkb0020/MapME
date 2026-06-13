import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { parseJavaScript } from './parsers/javascript.js';
import { parsePython } from './parsers/python.js';
import { parseHtml } from './parsers/html.js';
import { parseRust } from './parsers/rust.js';
import { generateMap } from './utils/mapExport.js';

/* ---------- state ---------- */
let selectedFilePath = null;
let selectedFileName = null;
let lastGeneratedMarkdown = '';
let parsedFunctions = [];
let currentLanguage = null;

/* ---------- status helpers ---------- */
function showStatus(msg, type = 'info') {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  el.className = `status-message status-${type}`;
}

function flashStatus(msg, duration = 2500) {
  const el = document.getElementById('pk-status-text');
  if (!el) return;
  const original = el.textContent;
  el.textContent = msg;
  setTimeout(() => { el.textContent = original; }, duration);
}

/* ---------- language detection ---------- */
function detectLanguage(path) {
  const ext = path.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript',
    py: 'python',
    html: 'html',
    rs: 'rust'
  };
  return map[ext] || 'unknown';
}

function getParser(language) {
  switch (language) {
    case 'javascript': return parseJavaScript;
    case 'python':     return parsePython;
    case 'html':       return parseHtml;
    case 'rust':       return parseRust;
    default:           return null;
  }
}

/* ---------- Documentation prompt generator ---------- */
function generateDocPrompt(fileName, language, functions) {
  const lang = language.toLowerCase();

  const prompts = {
    javascript: `I have a source file called ${fileName} that needs documentation comments added.

Please read through the file I will paste below and respond with a COMPLETE copy of the file with NO code changes whatsoever - only add JSDoc comments (/** ... */) directly above each function, arrow function, class, and constructor that is missing one.

Use this exact format for JSDoc comments:
/**
 * [One sentence describing what this function/class does]
 * [Optional: note any important side effects or return values]
 */

Functions and classes that already have JSDoc comments should be left exactly as-is.
Do not remove, rename, reorder, or change any code. Only add missing documentation.
Use only hyphen-dash ( - ) for any list items. Never use asterisks or bullet points.

Here is the file:
[paste file contents here]`,

    python: `I have a source file called ${fileName} that needs documentation added.

Please read through the file I will paste below and respond with a COMPLETE copy of the file with NO code changes whatsoever - only add docstrings directly inside each function and class that is missing one.

Use this exact format for docstrings:
def function_name(params):
    """One sentence describing what this function does."""
    [rest of function unchanged]

Docstrings should be the first statement inside the function or class body.
Functions and classes that already have docstrings should be left exactly as-is.
Do not remove, rename, reorder, or change any code. Only add missing documentation.
Use only hyphen-dash ( - ) for any list items. Never use asterisks or bullet points.

Here is the file:
[paste file contents here]`,

    rust: `I have a source file called ${fileName} that needs documentation added.

Please read through the file I will paste below and respond with a COMPLETE copy of the file with NO code changes whatsoever - only add /// doc comments directly above each fn, struct, impl, and pub item that is missing one.

Use this exact format:
/// One sentence describing what this function does.
/// Optional second line for important details.
fn function_name(params) {

Items that already have /// comments should be left exactly as-is.
Do not remove, rename, reorder, or change any code. Only add missing documentation.
Use only hyphen-dash ( - ) for any list items. Never use asterisks or bullet points.

Here is the file:
[paste file contents here]`,

    html: `I have an HTML file called ${fileName} that contains JavaScript. It needs JSDoc documentation added to its script blocks.

Please read through the file I will paste below and respond with a COMPLETE copy of the file with NO code changes whatsoever - only add JSDoc comments (/** ... */) directly above each function and arrow function inside script tags that is missing one.

Use this exact format:
/**
 * [One sentence describing what this function does]
 */

Functions that already have JSDoc comments should be left exactly as-is.
Do not modify the HTML, CSS, or any code. Only add missing documentation inside script blocks.
Use only hyphen-dash ( - ) for any list items. Never use asterisks or bullet points.

Here is the file:
[paste file contents here]`
  };

  return prompts[lang] || `Please add documentation to ${fileName} in the appropriate format for the language.`;
}

/* ---------- Tab switching ---------- */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });
}

/* ---------- UI wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {

  /* -- element refs -- */
  const filePickerBtn   = document.getElementById('file-picker-btn');
  const selectedFileSpan = document.getElementById('selected-file');
  const scanBtn         = document.getElementById('scan-btn');
  const copyBtn         = document.getElementById('copy-btn');
  const exportBtn       = document.getElementById('export-btn');
  const docPromptBtn    = document.getElementById('doc-prompt-btn');
  const statsBar        = document.getElementById('stats-bar');
  const statsLang       = document.getElementById('stats-language');
  const statsTotal      = document.getElementById('stats-total');
  const statsDoc        = document.getElementById('stats-documented');
  const resultsPanel    = document.getElementById('results-panel');
  const resultsToggle   = document.getElementById('results-toggle');
  const previewOutput   = document.getElementById('preview-output');
  const promptOutput    = document.getElementById('prompt-output');
  const promptCopyBtn   = document.getElementById('prompt-copy-btn');
  const promptEmptyState = document.getElementById('prompt-empty-state');

  /* -- tab buttons -- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* -- file picker -- */
  filePickerBtn.addEventListener('click', async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Source Files',
          extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'rs']
        }]
      });
      if (selected && typeof selected === 'string') {
        selectedFilePath = selected;
        selectedFileName = selected.split(/[\\/]/).pop();
        selectedFileSpan.textContent = selectedFileName.length > 40
          ? selectedFileName.substring(0, 37) + '...'
          : selectedFileName;
        selectedFileSpan.title = selectedFilePath;
        scanBtn.disabled = false;
        // Reset results
        lastGeneratedMarkdown = '';
        parsedFunctions = [];
        currentLanguage = null;
        copyBtn.disabled = true;
        exportBtn.disabled = true;
        docPromptBtn.disabled = true;
        promptCopyBtn.disabled = true;
        statsBar.style.display = 'none';
        resultsPanel.style.display = 'none';
        promptOutput.style.display = 'none';
        promptOutput.textContent = '';
        promptEmptyState.style.display = 'flex';
        showStatus('File selected. Ready to scan.', 'info');
      }
    } catch (err) {
      showStatus(`Error picking file: ${err}`, 'error');
    }
  });

  /* -- scan -- */
  scanBtn.addEventListener('click', async () => {
    if (!selectedFilePath) return;
    scanBtn.disabled = true;
    showStatus('Scanning...', 'info');
    flashStatus('⚡ Scanning...');
    try {
      const code = await readTextFile(selectedFilePath);
      currentLanguage = detectLanguage(selectedFilePath);
      const parser = getParser(currentLanguage);
      if (!parser) {
        showStatus(`Unsupported file type: .${selectedFilePath.split('.').pop()}`, 'error');
        scanBtn.disabled = false;
        return;
      }
      parsedFunctions = parser(code);
      lastGeneratedMarkdown = generateMap(selectedFileName, currentLanguage, parsedFunctions);

      // Update stats
      statsLang.textContent = `Language: ${currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1)}`;
      statsTotal.textContent = `Symbols: ${parsedFunctions.length}`;
      const documented = parsedFunctions.filter(f => f.docstring).length;
      statsDoc.textContent = `Documented: ${documented} / ${parsedFunctions.length}`;
      statsBar.style.display = 'flex';

      // Show map results
      previewOutput.textContent = lastGeneratedMarkdown;
      resultsPanel.style.display = 'block';
      previewOutput.style.display = 'block';
      resultsToggle.querySelector('.toggle-arrow').textContent = '▼';

      // Pre-generate and populate the doc prompt tab
      const prompt = generateDocPrompt(selectedFileName, currentLanguage, parsedFunctions);
      promptOutput.textContent = prompt;
      promptOutput.style.display = 'block';
      promptEmptyState.style.display = 'none';
      promptCopyBtn.disabled = false;

      copyBtn.disabled = false;
      exportBtn.disabled = false;
      docPromptBtn.disabled = false;
      showStatus(`Scan complete. ${parsedFunctions.length} symbols found.`, 'success');
      flashStatus('✅ Scan complete');
    } catch (err) {
      showStatus(`Scan failed: ${err}`, 'error');
      flashStatus('❌ Error');
    } finally {
      scanBtn.disabled = false;
    }
  });

  /* -- copy map -- */
  copyBtn.addEventListener('click', async () => {
    if (!lastGeneratedMarkdown) return;
    try {
      await navigator.clipboard.writeText(lastGeneratedMarkdown);
      flashStatus('📋 Copied!');
    } catch (err) {
      showStatus('Failed to copy to clipboard.', 'error');
    }
  });

  /* -- export map -- */
  exportBtn.addEventListener('click', async () => {
    if (!lastGeneratedMarkdown) return;
    try {
      const defaultName = selectedFileName.replace(/\.[^.]+$/, '') + '_map.md';
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      });
      if (savePath) {
        await writeTextFile(savePath, lastGeneratedMarkdown);
        flashStatus('💾 Exported!');
      }
    } catch (err) {
      showStatus(`Export failed: ${err}`, 'error');
    }
  });

  /* -- doc prompt button: switch to prompt tab -- */
  docPromptBtn.addEventListener('click', () => {
    switchTab('prompt');
  });

  /* -- copy prompt (inside prompt tab) -- */
  promptCopyBtn.addEventListener('click', async () => {
    if (!promptOutput.textContent) return;
    try {
      await navigator.clipboard.writeText(promptOutput.textContent);
      flashStatus('📝 Prompt copied!');
      promptCopyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        promptCopyBtn.innerHTML = '📋 Copy Prompt';
      }, 2000);
    } catch (err) {
      showStatus('Failed to copy prompt.', 'error');
    }
  });

  /* -- collapsible map preview -- */
  resultsToggle.addEventListener('click', () => {
    const arrow = resultsToggle.querySelector('.toggle-arrow');
    if (previewOutput.style.display === 'none') {
      previewOutput.style.display = 'block';
      arrow.textContent = '▼';
    } else {
      previewOutput.style.display = 'none';
      arrow.textContent = '▶';
    }
  });

  /* -- initial UI state -- */
  scanBtn.disabled = true;
  copyBtn.disabled = true;
  exportBtn.disabled = true;
  docPromptBtn.disabled = true;
  promptCopyBtn.disabled = true;
  statsBar.style.display = 'none';
  resultsPanel.style.display = 'none';
  showStatus('Select a source file to begin.', 'info');

});