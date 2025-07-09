# Google Meet Account Selector

A Chrome extension that helps users avoid joining Google Meet calls with the wrong account by allowing them to set a default Google account that will be automatically used for all Google Meet links.

## Description

This extension solves the common problem of accidentally joining Google Meet calls with the wrong Google account. Users can set their preferred default account through the extension interface, and the extension will automatically redirect Google Meet links to use that account. When accessing a Google Meet link with an incorrect account, the extension will seamlessly redirect to the same meeting using the user's preferred default account.

## Setup

To set up the project locally, follow these steps:

**Install Dependencies:**

    ```bash
    npm install
    ```

**Install Playwright Browsers (for E2E tests):**

    ```bash
    npx playwright install
    ```

**Load the Extension in Chrome (for development):**

    - Open Chrome and navigate to `chrome://extensions`.
    - Enable "Developer mode" (top right corner).
    - Click "Load unpacked" and select the `extension/` directory from this project.

## Code Formatting

Este proyecto utiliza [Prettier](https://prettier.io/) para el formateo automático del código y [Husky](https://typicode.github.io/husky/) con [lint-staged](https://github.com/okonet/lint-staged) para ejecutar el formateo automáticamente antes de cada commit.

### Scripts Disponibles

- `npm run format` - Formatea todos los archivos del proyecto
- `npm run format:check` - Verifica si los archivos están formateados correctamente
- `npm run format:watch` - Observa cambios y formatea automáticamente

### Pre-commit Hook

El proyecto está configurado con un pre-commit hook que automáticamente:

- Ejecuta Prettier en todos los archivos JavaScript, JSON, HTML, CSS y Markdown que están en el staging area
- Aplica el formateo automáticamente antes de hacer el commit
- Asegura que todo el código mantenga un estilo consistente

No necesitas hacer nada especial, simplemente haz commits normalmente y el formateo se aplicará automáticamente.
