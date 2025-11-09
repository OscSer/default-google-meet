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

  // Observe URL changes without injecting extra unused detection logic
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
