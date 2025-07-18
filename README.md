# Google Meet Selector

## Overview

A Chrome extension that helps users avoid joining Google Meet calls with the wrong account by allowing them to set a default Google account that will be automatically used for all Google Meet links.

This extension solves the common problem of accidentally joining Google Meet calls with the wrong Google account. Users can set their preferred default account through the extension interface, and the extension will automatically redirect Google Meet links to use that account. When accessing a Google Meet link with an incorrect account, the extension will seamlessly redirect to the same meeting using the user's preferred default account.

## Development

### Prerequisites

- Node.js and npm
- Chrome browser

### Setup

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Load the Extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (top right corner)
   - Click "Load unpacked" and select the `extension/` directory from this project
