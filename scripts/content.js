// Content script for Google Meet Extension

// Function to detect current active account on Google Meet
function detectCurrentAccount() {
  // Check URL for authuser parameter
  const urlParams = new URLSearchParams(window.location.search);
  const authuser = urlParams.get('authuser');
  
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  // Try to detect from DOM elements
  const accountElements = document.querySelectorAll('[data-email], [aria-label*="@"]');
  for (let element of accountElements) {
    const email = element.getAttribute('data-email') || 
                 element.textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
    if (email) {
      // This is a basic approach - in practice, you might need more sophisticated detection
      return 0; // Default to first account if we can't determine the index
    }
  }
  
  return 0; // Default to first account
}

// Function to show redirect notification
function showRedirectNotification(currentAccount, defaultAccount) {
  const notification = document.createElement('div');
  notification.id = 'meet-account-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1976d2;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Google Sans', Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 300px;
    ">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <div style="width: 12px; height: 12px; background: #1976d2; border-radius: 50%;"></div>
        </div>
        <div>
          <strong>Account Switched</strong><br>
          <small>Redirected to your default Google account</small>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove notification after 5 seconds
  setTimeout(() => {
    const notificationElement = document.getElementById('meet-account-notification');
    if (notificationElement) {
      notificationElement.remove();
    }
  }, 5000);
}

// Function to check and handle account mismatch
function checkAccountMismatch() {
  const currentUrl = window.location.href;
  
  // Only process if we're on a Google Meet page
  if (!currentUrl.includes('meet.google.com')) {
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'checkAccountMismatch',
    url: currentUrl
  }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    
    if (response && response.needsRedirect) {
      // Show notification before redirect
      showRedirectNotification(response.currentAccount, response.defaultAccount);
      
      // Redirect to the correct account after a short delay
      setTimeout(() => {
        window.location.href = response.redirectUrl;
      }, 1000);
    }
  });
}

// Function to initialize extension
function initializeExtension() {
  // Check for account mismatch on page load with delay
  setTimeout(() => {
    checkAccountMismatch();
  }, 2000);
  
  // Also check when URL changes (for SPA navigation)
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(checkAccountMismatch, 2000); // Delay to ensure page is loaded
    }
  });
  
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      currentAccount: detectCurrentAccount()
    });
  }
  
  if (request.action === 'detectCurrentAccount') {
    sendResponse({
      currentAccount: detectCurrentAccount()
    });
  }
});