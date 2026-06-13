# MapME

**A source file scanner that generates structured function maps for AI-assisted development.**

MapME is a lightweight desktop tool that reads your source files and extracts every function, its signature, parameters, and documentation — outputting a compact markdown document optimized for pasting into an LLM conversation. Instead of attaching full source files to your AI chat, paste a MapME function map. Same context, a fraction of the tokens.

---

## What MapME Does

Give MapME a source file. It returns a structured map of every function in that file: name, parameters, return type, and any existing documentation comments. The map is clean markdown, ready to paste directly into Claude, ChatGPT, Cursor, Copilot, or any other AI coding assistant.

**Supported file types:** `.js` `.jsx` `.ts` `.tsx` `.py` `.html` `.rs`

---

## Who This Is For

- **Developers using AI coding assistants** who want to give their LLM accurate project context without pasting thousands of lines of code
- **Anyone working on large codebases** who needs a fast, readable summary of what functions exist in a file
- **Teams using Claude, Cursor, GitHub Copilot, or ChatGPT** for code review, documentation, or refactoring tasks

---

## Why It Exists

When you attach a full source file to an AI chat, you're spending a large portion of your context window on code the LLM doesn't need — blank lines, imports, function bodies, comments. What the LLM actually needs to understand your codebase is the *shape* of it: what functions exist, what they accept, what they return, and what they do.

MapME extracts exactly that. A 500-line Python file becomes a 40-line function map. A complex JavaScript module with 20 exported functions becomes a clean reference sheet. You get better AI responses and use fewer tokens doing it.

---

## Key Features

- **Multi-language parsing** — JavaScript, JSX, TypeScript, TSX, Python, HTML (with embedded scripts), and Rust
- **Doc comment extraction** — captures JSDoc (`/** */`), Python docstrings (`"""`), and Rust doc comments (`///`)
- **Class and method awareness** — methods are prefixed with their class name (`Modal.open`, `Item::new`, `MyClass.render`)
- **Async and export detection** — flags async functions and exported symbols
- **Return type capture** — surfaces `-> Result<T, E>` in Rust and `-> type` annotations in Python
- **Decorator detection** — captures Python decorators including `@staticmethod`, `@classmethod`, `@property`, and Flask/FastAPI route decorators
- **Documentation prompt generator** — produces a ready-to-use LLM prompt that instructs an AI to add missing docstrings to your file in the exact format MapME can read back
- **One-click copy and markdown export** — paste into any LLM or save as a `.md` file for your project docs
- **Offline and free** — no API keys, no internet connection required, no usage limits

---

## Use Cases

**Giving an LLM context about your project**
Paste a MapME function map instead of raw source files. The LLM gets full visibility into your codebase structure at a fraction of the token cost.

**Getting AI help with a specific function**
Paste the map and say "explain what `parseConfig` does based on its signature and docs" — the LLM has everything it needs.

**Auditing undocumented code**
MapME shows you exactly which functions are missing documentation. Use the built-in Doc Prompt feature to generate an LLM prompt that adds the missing docs automatically.

**Onboarding to an unfamiliar codebase**
Scan a file you've never seen before and get an instant high-level map of what it contains.

**Code review prep**
Generate a function map before a review to quickly orient yourself in a large file.

---

## How the Doc Prompt Works

After scanning a file, MapME generates a plain-English prompt you can paste into any LLM along with your source file. The prompt instructs the LLM to return a fully documented copy of your file — with docstrings added to every undocumented function — using the exact comment format MapME can parse. Scan the documented file again and MapME will pick up all the new docs.

---

## Part of Context Kit

MapME is one tool in **Context Kit**, a suite of desktop utilities built for AI-assisted development workflows:

- **BriefME** — project brief generator that produces structured LLM-ready context documents for any codebase or project
- **TreeME** — folder structure scanner that generates a clean directory tree optimized for AI context
- **WriteME** — writing assistant tool for developer documentation

Each tool in the suite produces output designed to be pasted directly into an LLM conversation, giving your AI assistant the right context in the most compact form possible.

---

## Technical Details

- Built with **Tauri** (Rust backend) and **vanilla JavaScript** frontend
- All file reading via `@tauri-apps/plugin-fs` — no server, no cloud, no telemetry
- Parsers are static analysis only — no code execution, safe to run on any file
- Regex-based extraction handles CRLF and LF line endings
- Output is plain markdown compatible with any LLM, editor, or documentation system

---

## Alternatives Comparison

| Tool | What it does | Token cost |
|---|---|---|
| Attaching raw source files | Full file sent to LLM | Very high |
| Copy-pasting code snippets | Manual, error-prone | Medium |
| GitHub Copilot workspace context | Automatic but opaque | Unknown |
| **MapME** | Structured function map, human-readable | **Minimal** |

---

## Related Searches

If you found MapME looking for any of the following, you're in the right place:

- tools to reduce LLM token usage when sharing code
- how to give Claude context about my codebase without attaching files
- summarize a JavaScript / Python / Rust file for an AI assistant
- extract function signatures from source code
- generate documentation prompts for undocumented code
- AI workflow tools for developers
- codebase context tools for Cursor / Copilot / Claude
- function map generator for LLM context
- how to document Python functions with AI
- Tauri developer tools

---

## License

MIT