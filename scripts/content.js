function getCurrentAccount() {
  const urlParams = new URLSearchParams(window.location.search);
  const authuser = urlParams.get('authuser');
  
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  const detectedEmail = getCurrentEmail();
  
  if (detectedEmail) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'findAuthuserForEmail',
        email: detectedEmail
      }, (response) => {
        if (response && response.authuser !== null) {
          resolve(response.authuser);
        } else {
          resolve(null);
        }
      });
    });
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
      '[data-ved] [aria-label*="@"]'
    ];
    
    for (const selector of userSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const dataEmail = element.getAttribute('data-email') || 
                         element.getAttribute('data-identifier');
        if (dataEmail && dataEmail.includes('@')) {
          return dataEmail;
        }
        
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const emailMatch = ariaLabel.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
        
        const title = element.getAttribute('title');
        if (title) {
          const emailMatch = title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
        
        const textContent = element.textContent;
        if (textContent) {
          const emailMatch = textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            return emailMatch[0];
          }
        }
      }
    }
    
    const pageText = document.documentElement.outerHTML;
    const emailMatches = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    
    if (emailMatches && emailMatches.length > 0) {
      const filteredEmails = emailMatches.filter(email => 
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
    
    return null;
  } catch (error) {
    return null;
  }
}

function checkAccountSync() {
  const currentUrl = window.location.href;
  
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
      window.location.href = response.redirectUrl;
    }
  });
}

function initialize() {
  setTimeout(() => {
    checkAccountSync();
  }, 500);
  
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(checkAccountSync, 500);
    }
  });
  
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      currentAccount: getCurrentAccount()
    });
  }
  
  if (request.action === 'detectCurrentAccount') {
    sendResponse({
      currentAccount: getCurrentAccount()
    });
  }
});