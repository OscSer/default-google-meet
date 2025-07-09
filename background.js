// Background script for Google Meet Extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
});

// Store for cached accounts
let cachedAccounts = [];
let lastAccountFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get user info using Chrome Identity API
async function getUserInfo(token) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Function to get all Google accounts using Chrome Identity API
async function fetchGoogleAccounts() {
  const now = Date.now();
  if (cachedAccounts.length > 0 && (now - lastAccountFetch) < CACHE_DURATION) {
    return cachedAccounts;
  }

  try {
    // Use launchWebAuthFlow for web-based OAuth
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?' +
      'client_id=179898572754-489rcbhtfnjn0psrrqj1qe2kvp0g022t.apps.googleusercontent.com&' +
      'response_type=token&' +
      'redirect_uri=' + encodeURIComponent(redirectUri) + '&' +
      'scope=' + encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    
    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(redirectUrl);
        }
      });
    });

    if (!redirectUrl) {
      return [];
    }

    // Extract access token and authuser from URL
    const urlParams = new URLSearchParams(redirectUrl.split('#')[1]);
    const accessToken = urlParams.get('access_token');
    const authuser = urlParams.get('authuser');
    
    if (!accessToken) {
      return [];
    }

    // Get user info
    const userInfo = await getUserInfo(accessToken);
    if (!userInfo) {
      return [];
    }

    // Create account object with the correct authuser index
    const account = {
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      profilePicture: userInfo.picture,
      id: userInfo.id,
      index: authuser ? parseInt(authuser) : 0,
      authuser: authuser ? parseInt(authuser) : 0  // Store the real authuser value
    };

    cachedAccounts = [account];
    lastAccountFetch = now;
    
    // Auto-save as default account if no default is set
    chrome.storage.sync.get(['defaultAccount', 'defaultAuthuser'], (result) => {
      if (result.defaultAccount === undefined || result.defaultAuthuser === undefined) {
        chrome.storage.sync.set({
          defaultAccount: 0, // Array index 0 (first account)
          defaultAuthuser: account.authuser
        });
      }
    });
    
    return cachedAccounts;

  } catch (error) {
    return [];
  }
}

// Function to get current active account from a Google Meet URL
function getCurrentAccountFromURL(url) {
  const urlObj = new URL(url);
  const authuser = urlObj.searchParams.get('authuser');
  
  // If authuser is explicitly in URL, use it
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  // If no authuser parameter, we need to force redirect to ensure correct account
  // Return null to indicate we need to force the authuser parameter
  return null;
}

// Function to construct Google Meet URL with authuser parameter
function constructMeetURL(originalUrl, accountIndex) {
  const url = new URL(originalUrl);
  url.searchParams.set('authuser', accountIndex.toString());
  return url.toString();
}

// Function to get multiple accounts (if available)
async function getAllGoogleAccounts() {
  try {
    // If we have cached accounts and they're still valid, return them immediately
    if (cachedAccounts.length > 0 && (Date.now() - lastAccountFetch) < CACHE_DURATION) {
      return cachedAccounts;
    }
    
    return await fetchGoogleAccounts();
  } catch (error) {
    return [];
  }
}

// Function to clear cached token and get fresh token
async function refreshAuthToken() {
  try {
    // Clear cached accounts to force refresh
    cachedAccounts = [];
    lastAccountFetch = 0;
    
    // Get fresh accounts
    return await fetchGoogleAccounts();
  } catch (error) {
    console.error('Error in refreshAuthToken:', error);
    throw error; // Re-throw the error instead of returning empty array
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getAccounts') {
    getAllGoogleAccounts().then(accounts => {
      sendResponse({accounts: accounts});
    }).catch(error => {
      sendResponse({accounts: []});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'refreshAccounts') {
    refreshAuthToken().then(accounts => {
      sendResponse({accounts: accounts});
    }).catch(error => {
      console.error('Error in refreshAccounts:', error);
      sendResponse({error: error.message});
    });
    return true;
  }
  
  if (request.action === 'getDefaultAccount') {
    chrome.storage.sync.get(['defaultAccount'], (result) => {
      sendResponse({defaultAccount: result.defaultAccount || 0});
    });
    return true;
  }
  
  if (request.action === 'setDefaultAccount') {
    // Get the account from cached accounts to get the real authuser value
    const account = cachedAccounts[request.accountIndex];
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
    return true;
  }
  
  if (request.action === 'checkAccountMismatch') {
    const currentAccount = getCurrentAccountFromURL(request.url);
    
    chrome.storage.sync.get(['defaultAccount', 'defaultAuthuser'], (result) => {
      const defaultAccount = result.defaultAccount;
      const defaultAuthuser = result.defaultAuthuser;
      
      // If no default account is set, don't redirect
      if (defaultAccount === undefined || defaultAuthuser === undefined) {
        sendResponse({needsRedirect: false});
        return;
      }
      
      // Always redirect if URL doesn't have authuser parameter or doesn't match default authuser
      const needsRedirect = currentAccount === null || currentAccount !== defaultAuthuser;
      
      if (needsRedirect) {
        const redirectUrl = constructMeetURL(request.url, defaultAuthuser);
        
        sendResponse({
          needsRedirect: true,
          redirectUrl: redirectUrl,
          currentAccount: currentAccount,
          defaultAccount: defaultAuthuser
        });
      } else {
        sendResponse({needsRedirect: false});
      }
    });
    return true;
  }
});