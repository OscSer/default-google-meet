async function getCurrentAccount() {
  const urlParams = new URLSearchParams(window.location.search);
  const authuser = urlParams.get('authuser');

  if (authuser !== null) {
    return parseInt(authuser, 10);
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
          const emailMatch = ariaLabel.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
          );
          if (emailMatch) {
            return emailMatch[0];
          }
        }

        const title = element.getAttribute('title');
        if (title) {
          const emailMatch = title.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
          );
          if (emailMatch) {
            return emailMatch[0];
          }
        }

        const textContent = element.textContent;
        if (textContent) {
          const emailMatch = textContent.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
          );
          if (emailMatch) {
            return emailMatch[0];
          }
        }
      }
    }

    const pageText = document.documentElement.outerHTML;
    const emailMatches = pageText.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    );

    if (emailMatches && emailMatches.length > 0) {
      const filteredEmails = emailMatches.filter(
        email =>
          !email.includes('noreply') &&
          !email.includes('support') &&
          !email.includes('no-reply') &&
          !email.includes('example.com') &&
          !email.includes('google.com')
      );

      if (filteredEmails.length > 0) {
        return filteredEmails[0];
      }
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
  checkAccountSync(); // Initial check

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      checkAccountSync();
    }
  }, 1000); // Check every second for URL changes
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // For async responses, return true to keep the message channel open
  let responseSent = false;

  const handleRequest = async () => {
    if (request.action === 'getPageInfo') {
      const currentAccount = await getCurrentAccount();
      sendResponse({
        url: window.location.href,
        title: document.title,
        currentAccount: currentAccount,
      });
      responseSent = true;
    } else if (request.action === 'detectCurrentAccount') {
      const currentAccount = await getCurrentAccount();
      sendResponse({
        currentAccount: currentAccount,
      });
      responseSent = true;
    }
  };

  handleRequest();

  return responseSent; // Return true if sendResponse will be called asynchronously
});
