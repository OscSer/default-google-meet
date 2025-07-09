// Background script for Google Meet Extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
  
  // Start periodic account refresh
  startPeriodicAccountRefresh();
});

// Start periodic account refresh
function startPeriodicAccountRefresh() {
  // Refresh accounts every 30 minutes
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
  
  // Initial refresh after 5 seconds
  setTimeout(() => {
    refreshStoredAccounts();
  }, 5000);
  
  // Periodic refresh
  setInterval(() => {
    refreshStoredAccounts();
  }, REFRESH_INTERVAL);
  
}

// Store for cached accounts (cache disabled)
let cachedAccounts = [];
let lastAccountFetch = 0;
const CACHE_DURATION = 0; // Cache disabled

// Function to get all Google accounts with their authuser indices using browser session
async function getGoogleAccountsWithAuthuser() {
  try {
    
    // Use the enhanced Account Chooser endpoint as the primary method
    const accountChooserAccounts = await getActiveAccountsFromAccountChooser();
    if (accountChooserAccounts.length > 0) {
      return accountChooserAccounts;
    }
    
    // Fallback to other cookie/session based methods if the primary one fails
    const fallbackAccounts = await getAccountsFromAccountChooserFallback();
    if (fallbackAccounts.length > 0) {
        return fallbackAccounts;
    }

    return await extractAccountsFromCookies();

  } catch (error) {
    console.error('Error getting Google accounts:', error);
    return [];
  }
}

// Enhanced method to get active accounts via Google Account Chooser endpoint with cookies
async function getActiveAccountsFromAccountChooser() {
  try {
    
    const accountChooserUrl = 'https://accounts.google.com/v3/signin/accountchooser?flowName=GlifWebSignIn&flowEntry=AccountChooser';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(accountChooserUrl, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return [];
    }
    
    const responseText = await response.text();
    
    if (!responseText || responseText.length < 100) {
      console.warn('Account Chooser response seems empty or too short.');
      return [];
    }
    
    const accounts = [];
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    let match;
    const foundEmails = new Set();

    while ((match = emailRegex.exec(responseText)) !== null) {
        const email = match[0];
        if (email && !foundEmails.has(email) && !email.endsWith('google.com')) {
             foundEmails.add(email);
        }
    }

    let authuserIndex = 0;
    for (const email of foundEmails) {
        accounts.push({
            email: email,
            authuser: authuserIndex++
        });
    }
    
    // Remove duplicates based on email
    const uniqueAccounts = accounts.filter((account, index, self) =>
      index === self.findIndex(a => a.email === account.email)
    );
    
    uniqueAccounts.sort((a, b) => a.authuser - b.authuser);
    
    return uniqueAccounts;
  } catch (error) {
    console.error('Error getting active accounts from Account Chooser:', error);
    return [];
  }
}

// Fallback method for Account Chooser when primary endpoint fails
async function getAccountsFromAccountChooserFallback() {
  try {
    
    const fallbackUrl = 'https://accounts.google.com/AccountChooser';
    
    const response = await fetch(fallbackUrl, {
        method: 'GET',
        credentials: 'include'
    });
    
    if (response.ok) {
        const responseText = await response.text();
        if (responseText && responseText.length > 100) {
            const accounts = [];
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            let match;
            
            while ((match = emailPattern.exec(responseText)) !== null) {
                const email = match[0];
                if (!email.includes('google.com')) {
                    if (!accounts.find(acc => acc.email === email)) {
                        accounts.push({
                            email: email,
                            authuser: accounts.length,
                            source: 'fallback'
                        });
                    }
                }
            }
            if (accounts.length > 0) return accounts;
        }
    }
    return [];
  } catch (error) {
    console.error('All fallback methods failed:', error);
    return [];
  }
}

// Helper function to extract accounts from cookies
async function extractAccountsFromCookies() {
  try {
    const accounts = [];
    const cookies = await new Promise((resolve, reject) => {
      chrome.cookies.getAll({ domain: '.google.com' }, (cookies) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(cookies || []);
      });
    });
    
    if (!cookies || cookies.length === 0) return [];
    
    const accountCookies = cookies.filter(c => c.name.includes('ACCOUNT_CHOOSER'));
    
    for (const cookie of accountCookies) {
        let cookieValue;
        try {
          cookieValue = decodeURIComponent(cookie.value);
        } catch (e) {
          cookieValue = cookie.value;
        }
        
        const emailMatches = cookieValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatches) {
          emailMatches.forEach(email => {
            if (!email.includes('google.com')) {
                if (!accounts.find(acc => acc.email === email)) {
                  accounts.push({ email: email, authuser: accounts.length, source: 'cookie' });
                }
            }
          });
        }
    }
    
    accounts.sort((a, b) => a.authuser - b.authuser);
    return accounts;
  } catch (error) {
    console.error('Error extracting accounts from cookies:', error);
    return [];
  }
}

// Function to refresh stored accounts based on active browser accounts
async function refreshStoredAccounts() {
  try {
    const [storedAccounts, browserAccounts] = await Promise.all([
        getStoredAccounts(),
        getGoogleAccountsWithAuthuser()
    ]);

    if (browserAccounts.length === 0) {
        console.warn("Could not fetch any active accounts from browser. Aborting refresh.");
        return;
    }

    let hasChanges = false;
    
    const newAccounts = browserAccounts.map((browserAccount, index) => {
        const existingAccount = storedAccounts.find(sa => sa.email === browserAccount.email);
        const newAuthUser = index; // The authuser is simply the order in the session

        if (existingAccount) {
            if (existingAccount.authuser !== newAuthUser) {
                existingAccount.authuser = newAuthUser;
                hasChanges = true;
            }
            // Ensure index is also updated
            if (existingAccount.index !== index) {
                existingAccount.index = index;
                hasChanges = true;
            }
            return existingAccount;
        } else {
            hasChanges = true;
            return {
                email: browserAccount.email,
                name: browserAccount.email.split('@')[0],
                profilePicture: browserAccount.avatar || null,
                id: browserAccount.id || null,
                index: index,
                authuser: newAuthUser,
                addedAt: Date.now(),
                verified: true
            };
        }
    });

    // Check if the number of accounts has changed
    if (newAccounts.length !== storedAccounts.length) {
        hasChanges = true;
    }

    if (hasChanges) {
      await storeAccounts(newAccounts);
      cachedAccounts = newAccounts;
      lastAccountFetch = Date.now();
    } else {
    }
    
    return newAccounts;
  } catch (error) {
    console.error('Error refreshing stored accounts:', error);
    return await getStoredAccounts();
  }
}


// Function to get stored accounts from cache
async function getStoredAccounts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['accounts'], (result) => {
      const accounts = result.accounts || [];
      resolve(accounts);
    });
  });
}

// Function to store accounts in cache
async function storeAccounts(accounts) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ accounts: accounts }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error storing accounts:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Function to get current active account from a Google Meet URL
function getCurrentAccountFromURL(url) {
  const urlObj = new URL(url);
  const authuser = urlObj.searchParams.get('authuser');
  
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  return null;
}

// Function to construct Google Meet URL with authuser parameter
function constructMeetURL(originalUrl, accountIndex) {
  const url = new URL(originalUrl);
  url.searchParams.set('authuser', accountIndex.toString());
  return url.toString();
}

// Function to get all stored Google accounts
async function getAllGoogleAccounts() {
  try {
    return await refreshStoredAccounts();
  } catch (error) {
    console.error('Error in getAllGoogleAccounts:', error);
    return [];
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getAccounts') {
    getAllGoogleAccounts().then(accounts => {
      sendResponse({accounts: accounts});
    }).catch(error => {
      sendResponse({accounts: [], error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'getDefaultAccount') {
    chrome.storage.sync.get(['defaultAccount'], (result) => {
      sendResponse({defaultAccount: result.defaultAccount || 0});
    });
    return true;
  }
  
  if (request.action === 'setDefaultAccount') {
    getAllGoogleAccounts().then(accounts => {
        const account = accounts[request.accountIndex];
        if (account) {
          const defaultAuthuser = account.authuser;
          chrome.storage.sync.set({
            defaultAccount: request.accountIndex,
            defaultAuthuser: defaultAuthuser
          }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({success: false, error: chrome.runtime.lastError.message});
            } else {
              sendResponse({success: true});
            }
          });
        } else {
          sendResponse({success: false, error: 'Account not found'});
        }
    });
    return true;
  }

  if (request.action === 'refreshAccounts') {
    refreshStoredAccounts().then(accounts => {
        sendResponse({success: true, accounts: accounts});
    }).catch(error => {
        sendResponse({success: false, error: error.message});
    });
    return true;
  }
  
  if (request.action === 'checkAccountMismatch') {
    const currentAccount = getCurrentAccountFromURL(request.url);
    
    chrome.storage.sync.get(['defaultAccount', 'defaultAuthuser'], async (result) => {
      try {
        const defaultAccount = result.defaultAccount;
        let defaultAuthuser = result.defaultAuthuser;
        
        if (defaultAccount === undefined || defaultAuthuser === undefined) {
          sendResponse({needsRedirect: false, reason: 'No default account set'});
          return;
        }
        
        const storedAccounts = await getAllGoogleAccounts();
        const defaultAccountObj = storedAccounts.find(acc => acc.index === defaultAccount);
        
        if (!defaultAccountObj) {
          sendResponse({needsRedirect: false, reason: 'Default account not found'});
          return;
        }

        // The authuser should match the index in the new system
        defaultAuthuser = defaultAccountObj.index;
        
        const needsRedirect = (currentAccount === null && defaultAuthuser !== 0) || (currentAccount !== null && currentAccount !== defaultAuthuser);
        
        if (needsRedirect) {
          const redirectUrl = constructMeetURL(request.url, defaultAuthuser);
          sendResponse({
            needsRedirect: true,
            redirectUrl: redirectUrl,
            currentAccount: currentAccount,
            defaultAccount: defaultAuthuser,
            reason: 'Account mismatch'
          });
        } else {
          sendResponse({needsRedirect: false, reason: 'Account matches'});
        }
      } catch (error) {
        console.error('Error in checkAccountMismatch:', error);
        sendResponse({needsRedirect: false, reason: 'Error occurred', error: error.message});
      }
    });
    return true;
  }
  
  return true;
});
