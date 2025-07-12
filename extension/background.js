chrome.runtime.onInstalled.addListener(() => {
  startAccountRefresh();
  initializeTabTracking();
});

function startAccountRefresh() {
  const REFRESH_INTERVAL = 30 * 60 * 1000;

  setTimeout(() => {
    refreshAccounts();
  }, 5000);

  setInterval(() => {
    refreshAccounts();
  }, REFRESH_INTERVAL);
}

async function getActiveGoogleAccounts() {
  try {
    const accountChooserAccounts = await getAccountsFromChooser();
    if (accountChooserAccounts.length > 0) {
      return accountChooserAccounts;
    }

    const fallbackAccounts = await getAccountsFallback();
    if (fallbackAccounts.length > 0) {
      return fallbackAccounts;
    }

    return await getAccountsFromCookies();
  } catch (error) {
    return [];
  }
}

async function getAccountsFromChooser() {
  try {
    const accountChooserUrl =
      'https://accounts.google.com/v3/signin/accountchooser?flowName=GlifWebSignIn&flowEntry=AccountChooser';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(accountChooserUrl, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        authuser: authuserIndex++,
      });
    }

    const uniqueAccounts = accounts.filter(
      (account, index, self) =>
        index === self.findIndex(a => a.email === account.email)
    );

    uniqueAccounts.sort((a, b) => a.authuser - b.authuser);

    return uniqueAccounts;
  } catch (error) {
    return [];
  }
}

async function getAccountsFallback() {
  try {
    const fallbackUrl = 'https://accounts.google.com/AccountChooser';

    const response = await fetch(fallbackUrl, {
      method: 'GET',
      credentials: 'include',
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
                source: 'fallback',
              });
            }
          }
        }
        if (accounts.length > 0) return accounts;
      }
    }
    return [];
  } catch (error) {
    return [];
  }
}

async function getAccountsFromCookies() {
  try {
    const accounts = [];
    const cookies = await new Promise((resolve, reject) => {
      chrome.cookies.getAll({ domain: '.google.com' }, cookies => {
        if (chrome.runtime.lastError)
          reject(new Error(chrome.runtime.lastError.message));
        else resolve(cookies || []);
      });
    });

    if (!cookies || cookies.length === 0) return [];

    const accountCookies = cookies.filter(c =>
      c.name.includes('ACCOUNT_CHOOSER')
    );

    for (const cookie of accountCookies) {
      let cookieValue;
      try {
        cookieValue = decodeURIComponent(cookie.value);
      } catch (e) {
        cookieValue = cookie.value;
      }

      const emailMatches = cookieValue.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      );
      if (emailMatches) {
        emailMatches.forEach(email => {
          if (!email.includes('google.com')) {
            if (!accounts.find(acc => acc.email === email)) {
              accounts.push({
                email: email,
                authuser: accounts.length,
                source: 'cookie',
              });
            }
          }
        });
      }
    }

    accounts.sort((a, b) => a.authuser - b.authuser);
    return accounts;
  } catch (error) {
    return [];
  }
}

async function refreshAccounts() {
  try {
    const [storedAccounts, browserAccounts] = await Promise.all([
      getStoredAccounts(),
      getActiveGoogleAccounts(),
    ]);

    if (browserAccounts.length === 0) {
      return;
    }

    let hasChanges = false;

    const newAccounts = browserAccounts.map((browserAccount, index) => {
      const existingAccount = storedAccounts.find(
        sa => sa.email === browserAccount.email
      );
      const newAuthUser = index;

      if (existingAccount) {
        if (existingAccount.authuser !== newAuthUser) {
          existingAccount.authuser = newAuthUser;
          hasChanges = true;
        }
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
    return await getStoredAccounts();
  }
}

async function getStoredAccounts() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['accounts'], result => {
      const accounts = result.accounts || [];
      resolve(accounts);
    });
  });
}

async function storeAccounts(accounts) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ accounts: accounts }, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function getCurrentAccountFromURL(url) {
  const urlObj = new URL(url);
  const authuser = urlObj.searchParams.get('authuser');

  if (authuser !== null) {
    return parseInt(authuser);
  }

  return null;
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
    return [];
  }
}

const redirectedTabs = new Map();

function initializeTabTracking() {
  chrome.tabs.onRemoved.addListener(tabId => {
    redirectedTabs.delete(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url && !changeInfo.url.includes('meet.google.com')) {
      redirectedTabs.delete(tabId);
    }
  });
}

function markTabAsRedirected(tabId) {
  redirectedTabs.set(tabId, true);
}

function hasTabBeenRedirected(tabId) {
  return redirectedTabs.has(tabId);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabId') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }

  if (request.action === 'getAccounts') {
    getAllGoogleAccounts()
      .then(accounts => {
        sendResponse({ accounts: accounts });
      })
      .catch(error => {
        sendResponse({ accounts: [], error: error.message });
      });
    return true;
  }

  if (request.action === 'getDefaultAccount') {
    chrome.storage.sync.get(['defaultAccount'], result => {
      sendResponse({ defaultAccount: result.defaultAccount || 0 });
    });
    return true;
  }

  if (request.action === 'setDefaultAccount') {
    getAllGoogleAccounts().then(accounts => {
      const account = accounts[request.accountIndex];
      if (account) {
        const defaultAuthuser = account.authuser;
        chrome.storage.sync.set(
          {
            defaultAccount: request.accountIndex,
            defaultAuthuser: defaultAuthuser,
          },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              sendResponse({ success: true });
            }
          }
        );
      } else {
        sendResponse({ success: false, error: 'Account not found' });
      }
    });
    return true;
  }

  if (request.action === 'refreshAccounts') {
    refreshAccounts()
      .then(accounts => {
        sendResponse({ success: true, accounts: accounts });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'checkAccountMismatch') {
    const currentAccount = getCurrentAccountFromURL(request.url);
    const tabId = request.tabId;

    if (hasTabBeenRedirected(tabId)) {
      sendResponse({
        needsRedirect: false,
        reason: 'Tab already redirected once',
      });
      return;
    }

    chrome.storage.sync.get(
      ['defaultAccount', 'defaultAuthuser'],
      async result => {
        try {
          const defaultAccount = result.defaultAccount;
          let defaultAuthuser = result.defaultAuthuser;

          if (defaultAccount === undefined || defaultAuthuser === undefined) {
            sendResponse({
              needsRedirect: false,
              reason: 'No default account set',
            });
            return;
          }

          const storedAccounts = await getAllGoogleAccounts();
          const defaultAccountObj = storedAccounts.find(
            acc => acc.index === defaultAccount
          );

          if (!defaultAccountObj) {
            sendResponse({
              needsRedirect: false,
              reason: 'Default account not found',
            });
            return;
          }

          defaultAuthuser = defaultAccountObj.index;

          const needsRedirect =
            (currentAccount === null && defaultAuthuser !== 0) ||
            (currentAccount !== null && currentAccount !== defaultAuthuser);

          if (needsRedirect) {
            markTabAsRedirected(tabId);
            const redirectUrl = constructMeetURL(request.url, defaultAuthuser);
            sendResponse({
              needsRedirect: true,
              redirectUrl: redirectUrl,
              currentAccount: currentAccount,
              defaultAccount: defaultAuthuser,
              reason: 'Account mismatch',
            });
          } else {
            sendResponse({ needsRedirect: false, reason: 'Account matches' });
          }
        } catch (error) {
          sendResponse({
            needsRedirect: false,
            reason: 'Error occurred',
            error: error.message,
          });
        }
      }
    );
    return true;
  }

  return true;
});
