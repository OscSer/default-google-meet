async function getCurrentAccount() {
  const authuser = getAuthuserFromURL(window.location.href);

  if (authuser !== null) {
    return authuser;
  }

  const detectedEmail = getCurrentEmail();

  if (detectedEmail) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'findAuthuserForEmail',
        email: detectedEmail,
      });
      if (response && response.authuser !== null) {
        return response.authuser;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error in findAuthuserForEmail message:', error);
      return null;
    }
  }

  return null;
}

function getCurrentEmail() {
  try {
    const userSelectors = [
      '[data-email]',
      '[aria-label*="@"]',
      '[data-identifier]',
      '.gb_A[aria-label*="@"]',
      '.gb_A[title*="@"]',
      '.gb_A .gb_Tb',
      '.gb_A .gb_Vb',
      '[role="button"][aria-label*="@"]',
      '[data-ved] [aria-label*="@"]',
    ];

    for (const selector of userSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const dataEmail =
          element.getAttribute('data-email') ||
          element.getAttribute('data-identifier');
        if (dataEmail && dataEmail.includes('@')) {
          return dataEmail;
        }

        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const email = findFirstEmailInText(ariaLabel);
          if (email) {
            return email;
          }
        }

        const title = element.getAttribute('title');
        if (title) {
          const email = findFirstEmailInText(title);
          if (email) {
            return email;
          }
        }

        const textContent = element.textContent;
        if (textContent) {
          const email = findFirstEmailInText(textContent);
          if (email) {
            return email;
          }
        }
      }
    }

    const pageText = document.body.textContent;
    const email = findFirstValidEmail(pageText);

    if (email) {
      return email;
    }
    console.warn('No email detected on the page.');
    return null;
  } catch (error) {
    console.error('Error in getCurrentEmail:', error);
    return null;
  }
}

async function checkAccountSync() {
  const currentUrl = window.location.href;

  if (!currentUrl.includes('meet.google.com')) {
    return;
  }

  try {
    const tabResponse = await chrome.runtime.sendMessage({
      action: 'getTabId',
    });

    if (!tabResponse?.tabId) {
      console.warn('Could not get tab ID.');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'checkAccountMismatch',
      url: currentUrl,
      tabId: tabResponse.tabId,
    });

    if (response && response.needsRedirect) {
      window.location.href = response.redirectUrl;
    }
  } catch (error) {
    console.error('Error in checkAccountSync:', error);
  }
}

function initialize() {
  checkAccountSync();

  let checkTimeout;
  const debouncedCheck = () => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkAccountSync, 1000);
  };

  window.addEventListener('popstate', debouncedCheck);

  const originalPushState = history.pushState;
  history.pushState = function (state, title, url) {
    const result = originalPushState.apply(this, arguments);
    debouncedCheck();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (state, title, url) {
    const result = originalReplaceState.apply(this, arguments);
    debouncedCheck();
    return result;
  };

  const titleElement = document.querySelector('title');
  if (titleElement) {
    const observer = new MutationObserver(debouncedCheck);
    observer.observe(titleElement, { childList: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
