// Content script for Google Meet Extension

// Function to detect current active account on Google Meet
function detectCurrentAccount() {
  // Check URL for authuser parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const authuser = urlParams.get('authuser');
  
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  // Try to detect current account email from DOM
  const detectedEmail = detectCurrentEmail();
  
  if (detectedEmail) {
    console.log(`Detected current email from DOM: ${detectedEmail}`);
    
    // Ask background script to find the authuser for this email
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'findAuthuserForEmail',
        email: detectedEmail
      }, (response) => {
        if (response && response.authuser !== null) {
          console.log(`Found authuser ${response.authuser} for email ${detectedEmail}`);
          resolve(response.authuser);
        } else {
          console.log(`Could not find authuser for email ${detectedEmail}, defaulting to null`);
          resolve(null);
        }
      });
    });
  }
  
  // If no email detected, return null to indicate unknown
  return null;
}

// Function to detect current email from DOM elements
function detectCurrentEmail() {
  try {
    // Method 1: Look for user info button/avatar
    const userSelectors = [
      '[data-email]',
      '[aria-label*="@"]',
      '[data-identifier]',
      '.gb_A[aria-label*="@"]', // Google bar user menu
      '.gb_A[title*="@"]',
      '.gb_A .gb_Tb', // Google bar user name
      '.gb_A .gb_Vb', // Google bar user email
      '[role="button"][aria-label*="@"]',
      '[data-ved] [aria-label*="@"]'
    ];
    
    for (const selector of userSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check data attributes
        const dataEmail = element.getAttribute('data-email') || 
                         element.getAttribute('data-identifier');
        if (dataEmail && dataEmail.includes('@')) {
          return dataEmail;
        }
        
        // Check aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const emailMatch = ariaLabel.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
        
        // Check title
        const title = element.getAttribute('title');
        if (title) {
          const emailMatch = title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
        
        // Check text content
        const textContent = element.textContent;
        if (textContent) {
          const emailMatch = textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
      }
    }
    
    // Method 2: Look in page source for email patterns
    const pageText = document.documentElement.outerHTML;
    const emailMatches = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    
    if (emailMatches && emailMatches.length > 0) {
      // Filter out common false positives
      const filteredEmails = emailMatches.filter(email => 
        !email.includes('noreply') && 
        !email.includes('support') && 
        !email.includes('no-reply') &&
        !email.includes('example.com') &&
        !email.includes('google.com') // Usually not user emails
      );
      
      if (filteredEmails.length > 0) {
        // Return the first valid email found
        return filteredEmails[0];
      }
    }
    
    console.log('Could not detect current email from DOM');
    return null;
  } catch (error) {
    console.error('Error detecting current email:', error);
    return null;
  }
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
      // Redirect to the correct account immediately
      window.location.href = response.redirectUrl;
    }
  });
}

// Function to initialize extension
function initializeExtension() {
  // Check for account mismatch on page load with delay
  setTimeout(() => {
    checkAccountMismatch();
  }, 500);
  
  // Also check when URL changes (for SPA navigation)
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(checkAccountMismatch, 500); // Delay to ensure page is loaded
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