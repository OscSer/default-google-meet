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

// Function to get stored accounts from cache
async function getStoredAccounts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['accounts'], (result) => {
      const accounts = result.accounts || [];
      console.log('Stored accounts:', accounts);
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
        console.log('Accounts stored successfully');
        resolve(true);
      }
    });
  });
}



// Function to add a new Google account using Chrome Identity API
async function addGoogleAccount() {
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
      throw new Error('No redirect URL received');
    }

    // Extract access token from URL
    const urlParams = new URLSearchParams(redirectUrl.split('#')[1]);
    const accessToken = urlParams.get('access_token');
    
    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Get user info
    const userInfo = await getUserInfo(accessToken);
    if (!userInfo) {
      throw new Error('Failed to get user info');
    }

    // Get existing accounts
    const existingAccounts = await getStoredAccounts();
    
    // Check if account already exists
    const accountExists = existingAccounts.find(acc => acc.email === userInfo.email);
    if (accountExists) {
      console.log('Account already exists:', userInfo.email);
      return { success: false, error: 'Account already exists', account: accountExists };
    }

    // Create new account object
    const newAccount = {
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      profilePicture: userInfo.picture,
      id: userInfo.id,
      index: existingAccounts.length,
      authuser: existingAccounts.length,
      addedAt: Date.now()
    };

    // Add to existing accounts
    const updatedAccounts = [...existingAccounts, newAccount];
    
    // Store updated accounts
    const stored = await storeAccounts(updatedAccounts);
    if (!stored) {
      throw new Error('Failed to store account');
    }

    // Update cached accounts
    cachedAccounts = updatedAccounts;
    lastAccountFetch = Date.now();
    
    // Always set new account as default
    chrome.storage.sync.set({
      defaultAccount: newAccount.index,
      defaultAuthuser: newAccount.authuser
    });
    
    return { success: true, account: newAccount };

  } catch (error) {
    console.error('Error adding Google account:', error);
    return { success: false, error: error.message };
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

// Function to get all stored Google accounts
async function getAllGoogleAccounts() {
  try {
    // If we have cached accounts and they're still valid, return them immediately
    if (cachedAccounts.length > 0 && (Date.now() - lastAccountFetch) < CACHE_DURATION) {
      return cachedAccounts;
    }
    
    // Get accounts from storage
    const storedAccounts = await getStoredAccounts();
    
    // Update cache
    cachedAccounts = storedAccounts;
    lastAccountFetch = Date.now();
    
    return storedAccounts;
  } catch (error) {
    console.error('Error in getAllGoogleAccounts:', error);
    return [];
  }
}

// Function to remove an account from storage
async function removeAccount(accountIndex) {
  try {
    const storedAccounts = await getStoredAccounts();
    
    if (accountIndex < 0 || accountIndex >= storedAccounts.length) {
      throw new Error('Invalid account index');
    }
    
    // Remove account from array
    const updatedAccounts = storedAccounts.filter((_, index) => index !== accountIndex);
    
    // Update indices for remaining accounts
    updatedAccounts.forEach((account, index) => {
      account.index = index;
      account.authuser = index;
    });
    
    // Store updated accounts
    const stored = await storeAccounts(updatedAccounts);
    if (!stored) {
      throw new Error('Failed to store updated accounts');
    }
    
    // Update cache
    cachedAccounts = updatedAccounts;
    lastAccountFetch = Date.now();
    
    // If removed account was default, set first account as default
    chrome.storage.sync.get(['defaultAccount'], (result) => {
      if (result.defaultAccount === accountIndex) {
        if (updatedAccounts.length > 0) {
          chrome.storage.sync.set({
            defaultAccount: 0,
            defaultAuthuser: updatedAccounts[0].authuser
          });
        } else {
          chrome.storage.sync.remove(['defaultAccount', 'defaultAuthuser']);
        }
      } else if (result.defaultAccount > accountIndex) {
        // Adjust default account index if it was after the removed account
        chrome.storage.sync.set({
          defaultAccount: result.defaultAccount - 1
        });
      }
    });
    
    return { success: true, accounts: updatedAccounts };
  } catch (error) {
    console.error('Error removing account:', error);
    return { success: false, error: error.message };
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getAccounts') {
    console.log('Received getAccounts request');
    getAllGoogleAccounts().then(accounts => {
      console.log('Sending accounts response:', accounts);
      sendResponse({accounts: accounts});
    }).catch(error => {
      console.error('Error getting accounts:', error);
      sendResponse({accounts: [], error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'addAccount') {
    console.log('Received addAccount request');
    addGoogleAccount().then(result => {
      console.log('Add account result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Error adding account:', error);
      sendResponse({success: false, error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'removeAccount') {
    console.log('Received removeAccount request for index:', request.accountIndex);
    removeAccount(request.accountIndex).then(result => {
      console.log('Remove account result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Error removing account:', error);
      sendResponse({success: false, error: error.message});
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