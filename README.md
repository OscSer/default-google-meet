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
