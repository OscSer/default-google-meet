// 1. Alarms API for refreshing
importScripts('scripts/utils.js');

const REFRESH_INTERVAL_MINUTES = 30;
const FETCH_TIMEOUT_MS = 10000;
const INITIAL_REFRESH_DELAY_MIN = 1;

chrome.runtime.onInstalled.addListener(() => {
  initializeAlarms();
  initializeTabTracking();
});

function initializeAlarms() {
  chrome.alarms.create('refreshAccounts', {
    delayInMinutes: INITIAL_REFRESH_DELAY_MIN, // Initial refresh after 1 minute
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refreshAccounts') {
    refreshAccounts();
  }
});

// 2. Centralized Email Extraction + Improved Error Handling
function extractEmailsFromText(text) {
  const emails = extractEmails(text);
  return emails.filter(email => !email.endsWith('google.com'));
}

async function getActiveGoogleAccounts() {
  try {
    const htmlAccounts = await getAccountsFromHTML();
    if (htmlAccounts.length > 0) {
      return htmlAccounts;
    }

    return await getAccountsFromCookies();
  } catch (error) {
    console.error('Error getting active Google accounts:', error);
    return [];
  }
}

async function getAccountsFromHTML() {
  try {
    const accountChooserUrl = 'https://accounts.google.com/AccountChooser';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(accountChooserUrl, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const responseText = await response.text();

    if (!responseText || responseText.length < 100) {
      return [];
    }

    const emails = extractEmailsFromText(responseText);
    return emails.map((email, index) => ({
      email: email,
      authuser: index,
    }));
  } catch (error) {
    console.error('Error fetching accounts from HTML:', error);
    return [];
  }
}

async function getAccountsFromCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.google.com' });

    if (!cookies || cookies.length === 0) return [];

    const accountCookies = cookies.filter(c =>
      c.name.includes('ACCOUNT_CHOOSER')
    );

    const allEmails = new Set();

    for (const cookie of accountCookies) {
      let cookieValue;
      try {
        cookieValue = decodeURIComponent(cookie.value);
      } catch (e) {
        cookieValue = cookie.value;
      }
      const emails = extractEmailsFromText(cookieValue);
      emails.forEach(email => allEmails.add(email));
    }

    return Array.from(allEmails).map((email, index) => ({
      email: email,
      authuser: index,
      source: 'cookie',
    }));
  } catch (error) {
    console.error('Error fetching accounts from cookies:', error);
    return [];
  }
}

// 3. Native promises for chrome.storage
async function getStoredAccounts() {
  try {
    const result = await chrome.storage.sync.get(['accounts']);
    return result.accounts || [];
  } catch (error) {
    console.error('Error getting stored accounts:', error);
    return [];
  }
}

async function storeAccounts(accounts) {
  try {
    await chrome.storage.sync.set({ accounts: accounts });
    return true;
  } catch (error) {
    console.error('Error storing accounts:', error);
    return false;
  }
}

// Migration function: Convert defaultAccount (index) to defaultEmail
async function migrateDefaultAccountToEmail() {
  try {
    const storage = await chrome.storage.sync.get([
      'defaultAccount',
      'defaultEmail',
    ]);

    // If already migrated, skip
    if (storage.defaultEmail) {
      return storage.defaultEmail;
    }

    // If no defaultAccount set, return null
    if (storage.defaultAccount === undefined) {
      return null;
    }

    // Get current accounts to find email by index
    const accounts = await getStoredAccounts();
    const account = accounts[storage.defaultAccount];

    if (account && account.email) {
      // Migrate to email-based system
      await chrome.storage.sync.set({
        defaultEmail: account.email,
        // Keep old value for fallback during transition
        defaultAccount_legacy: storage.defaultAccount,
      });
      console.log(
        'Migrated default account from index to email:',
        account.email
      );
      return account.email;
    }

    return null;
  } catch (error) {
    console.error('Error migrating default account:', error);
    return null;
  }
}

// Get default account email with migration
async function getDefaultAccountEmail() {
  try {
    const storage = await chrome.storage.sync.get([
      'defaultEmail',
      'defaultAccount',
    ]);

    // Try new email-based system first
    if (storage.defaultEmail) {
      return storage.defaultEmail;
    }

    // Fallback to migration if needed
    return await migrateDefaultAccountToEmail();
  } catch (error) {
    console.error('Error getting default account email:', error);
    return null;
  }
}

// Validate account data integrity
function validateAccount(account) {
  if (!account || typeof account !== 'object') {
    return false;
  }

  if (!account.email || typeof account.email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(account.email)) {
    return false;
  }

  if (account.authuser !== undefined && typeof account.authuser !== 'number') {
    return false;
  }

  return true;
}

// Enhanced account refresh with validation
async function refreshAccounts() {
  try {
    const [storedAccounts, browserAccounts] = await Promise.all([
      getStoredAccounts(),
      getActiveGoogleAccounts(),
    ]);

    if (browserAccounts.length === 0) {
      return storedAccounts.filter(validateAccount);
    }

    const storedAccountsMap = new Map(
      storedAccounts.map(acc => [acc.email, acc])
    );
    let hasChanges = false;

    const newAccounts = browserAccounts
      .filter(validateAccount)
      .map((browserAccount, index) => {
        const existingAccount = storedAccountsMap.get(browserAccount.email);
        const newAuthUser = index;

        if (existingAccount) {
          if (
            existingAccount.authuser !== newAuthUser ||
            existingAccount.index !== index
          ) {
            hasChanges = true;
            return { ...existingAccount, authuser: newAuthUser, index: index };
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
            verified: true,
          };
        }
      });

    if (newAccounts.length !== storedAccounts.length) {
      hasChanges = true;
    }

    if (hasChanges) {
      await storeAccounts(newAccounts);
    }

    return newAccounts;
  } catch (error) {
    console.error('Error refreshing accounts:', error);
    return getStoredAccounts().filter(validateAccount);
  }
}

// Utility functions
function getCurrentAccountFromURL(url) {
  try {
    const urlObj = new URL(url);
    const authuser = urlObj.searchParams.get('authuser');
    return authuser !== null ? parseInt(authuser, 10) : null;
  } catch (e) {
    return null;
  }
}

function constructMeetURL(originalUrl, accountIndex) {
  const url = new URL(originalUrl);
  url.searchParams.set('authuser', accountIndex.toString());
  return url.toString();
}

async function getAllGoogleAccounts() {
  try {
    return await refreshAccounts();
  } catch (error) {
    console.error('Error getting all Google accounts:', error);
    return [];
  }
}

// 5. Persistent Tab Tracking using chrome.storage.session
function initializeTabTracking() {
  chrome.tabs.onRemoved.addListener(tabId => {
    chrome.storage.session.remove(String(tabId));
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url && !changeInfo.url.includes('meet.google.com')) {
      chrome.storage.session.remove(String(tabId));
    }
  });
}

async function markTabAsRedirected(tabId) {
  await chrome.storage.session.set({ [String(tabId)]: true });
}

async function hasTabBeenRedirected(tabId) {
  const result = await chrome.storage.session.get(String(tabId));
  return result[String(tabId)] === true;
}

// 6. Refactored onMessage listener and logic extraction
async function handleAccountMismatch(url, tabId) {
  const currentAccount = getCurrentAccountFromURL(url);

  if (await hasTabBeenRedirected(tabId)) {
    return { needsRedirect: false, reason: 'Tab already redirected' };
  }

  try {
    const defaultEmail = await getDefaultAccountEmail();

    if (!defaultEmail) {
      return { needsRedirect: false, reason: 'No default account set' };
    }

    const storedAccounts = await getAllGoogleAccounts();
    const defaultAccountObj = storedAccounts.find(
      acc => acc.email === defaultEmail
    );

    if (!defaultAccountObj) {
      // Fallback: try to find by legacy index if migration failed
      const legacyStorage = await chrome.storage.sync.get(
        'defaultAccount_legacy'
      );
      if (legacyStorage.defaultAccount_legacy !== undefined) {
        const fallbackAccount =
          storedAccounts[legacyStorage.defaultAccount_legacy];
        if (fallbackAccount) {
          console.warn('Using legacy fallback for default account');
          return await handleAccountMismatchWithAccount(
            url,
            tabId,
            fallbackAccount
          );
        }
      }
      return {
        needsRedirect: false,
        reason: 'Default account not found in stored accounts',
      };
    }

    return await handleAccountMismatchWithAccount(
      url,
      tabId,
      defaultAccountObj
    );
  } catch (error) {
    return {
      needsRedirect: false,
      reason: 'Error checking account mismatch',
      error: error.message,
    };
  }
}

async function handleAccountMismatchWithAccount(url, tabId, accountObj) {
  const currentAccount = getCurrentAccountFromURL(url);
  const defaultAuthuser = accountObj.authuser;

  const needsRedirect =
    (currentAccount === null && defaultAuthuser !== 0) ||
    (currentAccount !== null && currentAccount !== defaultAuthuser);

  if (needsRedirect) {
    await markTabAsRedirected(tabId);
    const redirectUrl = constructMeetURL(url, defaultAuthuser);
    return {
      needsRedirect: true,
      redirectUrl,
      currentAccount,
      defaultAccount: defaultAuthuser,
      reason: 'Account mismatch',
    };
  } else {
    return { needsRedirect: false, reason: 'Account matches' };
  }
}

const messageHandlers = {
  getTabId: (request, sender, sendResponse) => {
    sendResponse({ tabId: sender.tab?.id });
  },
  getAccounts: async (request, sender, sendResponse) => {
    try {
      const accounts = await getAllGoogleAccounts();
      sendResponse({ accounts });
    } catch (error) {
      sendResponse({ accounts: [], error: error.message });
    }
  },
  getDefaultAccount: async (request, sender, sendResponse) => {
    try {
      const defaultEmail = await getDefaultAccountEmail();
      if (defaultEmail) {
        const accounts = await getAllGoogleAccounts();
        const accountIndex = accounts.findIndex(
          acc => acc.email === defaultEmail
        );
        sendResponse({ defaultAccount: accountIndex >= 0 ? accountIndex : 0 });
      } else {
        sendResponse({ defaultAccount: 0 });
      }
    } catch (error) {
      console.error('Error getting default account:', error);
      sendResponse({ defaultAccount: 0, error: error.message });
    }
  },
  setDefaultAccount: async (request, sender, sendResponse) => {
    try {
      const accounts = await getAllGoogleAccounts();
      const account = accounts[request.accountIndex];

      if (!account || !validateAccount(account)) {
        sendResponse({ success: false, error: 'Invalid account data' });
        return;
      }

      if (account.email) {
        // Only save the email, not authuser (which can change with account reordering)
        await chrome.storage.sync.set({
          defaultEmail: account.email,
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Account email not found' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  },
  refreshAccounts: async (request, sender, sendResponse) => {
    try {
      const accounts = await refreshAccounts();
      sendResponse({ success: true, accounts });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  },
  checkAccountMismatch: async (request, sender, sendResponse) => {
    const { url, tabId } = request;
    const result = await handleAccountMismatch(url, tabId);
    sendResponse(result);
  },
  findAuthuserForEmail: async (request, sender, sendResponse) => {
    try {
      const accounts = await getAllGoogleAccounts();
      const foundAccount = accounts.find(acc => acc.email === request.email);
      if (foundAccount) {
        sendResponse({ authuser: foundAccount.authuser });
      } else {
        sendResponse({ authuser: null, error: 'Account not found' });
      }
    } catch (error) {
      console.error('Error finding authuser for email:', error);
      sendResponse({ authuser: null, error: error.message });
    }
  },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    handler(request, sender, sendResponse);
    return true; // Indicates that the response is sent asynchronously
  }
  return false;
});
