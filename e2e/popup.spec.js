import { test, expect } from '@playwright/test';

test('popup opens and displays title', async ({ page, context }) => {
  // Abrir el popup de la extensión
  const extensionId = await getExtensionId(context);
  await page.goto(`chrome-extension://${extensionId}/extension/popup/popup.html`);

  // Verificar que el título del popup es correcto
  await expect(page.locator('h1')).toHaveText('Google Meet Account Selector');
});

async function getExtensionId(context) {
  // Playwright no expone directamente el ID de la extensión cargada.
  // Una forma de obtenerlo es inspeccionar las páginas de fondo o de la extensión.
  // Aquí asumimos que la extensión tiene una página de fondo (background.js).
  const backgroundPage = context.backgroundPages().length > 0 ? context.backgroundPages()[0] : await context.waitForEvent('backgroundpage');
  return backgroundPage.url().split('/')[2];
}
