# AGENTS.md

## Build/Lint/Test

- Install: `npm ci`
- Build: `npm run build` → creates `build/extension.zip`
- Format: `npm run format` | Check: `npm run format:check`
- Release: `npm run release` | Dry: `npm run release:dry`
- Tests: none in repo; manual testing in Chrome (`chrome://extensions` → Load unpacked `extension/`)

## Code Style

- Language: JavaScript (no TypeScript). Use ES2015+ features.
- Imports: No bundler. Use relative paths; `importScripts('scripts/utils.js')` in background; avoid dynamic/import maps.
- Types: Prefer JSDoc for public functions when clarity helps.
- Naming: camelCase vars/functions, PascalCase classes, UPPER_SNAKE_CASE constants; filenames kebab-case.
- Formatting: Prettier v3 (singleQuote, semi, printWidth 80, trailingComma es5, arrowParens avoid).
- Async: Prefer async/await; wrap Chrome APIs that support promises; avoid chained .then().
- Error handling: try/catch; log with `console.error('context:', error)`; never swallow errors.
- Chrome APIs: use `chrome.runtime`, `chrome.storage`, `chrome.tabs`, `chrome.alarms`, `chrome.cookies`; return `true` from listeners when responding async.
- DOM/content scripts: guard nulls; avoid blocking loops; prefer querySelector and MutationObserver.
