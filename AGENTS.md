# AGENTS.md

## Build/Lint/Test Commands

- **Build**: `npm run build` - Creates extension.zip in build/ directory
- **Format**: `npm run format` - Formats code with Prettier
- **Format Check**: `npm run format:check` - Verifies Prettier formatting
- **Pre-commit**: `npx lint-staged` - Runs formatting on staged files
- **No test framework** - Manual testing required for Chrome extension

## Code Style Guidelines

- **Declarations**: `const`/`let` preferred over `var`
- **Promises**: Async/await pattern preferred over .then()
- **Error Handling**: Try/catch blocks with `console.error()` for logging
- **Chrome APIs**: Use chrome.runtime, chrome.storage, chrome.tabs, etc.
- **Comments**: Minimal, code should be self-documenting

## Commit Message Format

Follow Conventional Commits:

- **Structure**: `<type>(<scope>): <subject>`
- **Types**: feat, fix, docs, style, refactor, test, chore
- **Scope**: Optional, e.g. background, popup, content
- **Subject**: Brief description, imperative mood, max 50 chars
- **Body**: Optional, detailed explanation, max 72 chars per line
