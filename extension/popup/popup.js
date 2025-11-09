document.addEventListener('DOMContentLoaded', function () {
  const contentDiv = document.getElementById('content');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');
  const accountsContainer = document.getElementById('accounts-container');
  const retryBtn = document.getElementById('retry-btn');

  const REVIEW_URL =
    'https://chromewebstore.google.com/detail/google-meet-selector/kgejkghcnljcmpfnncbggbpioinaekfo/reviews';
  const COFFEE_URL = 'https://buymeacoffee.com/oserna';

  let accounts = [];
  let defaultAccountEmail = null;

  function showContent() {
    contentDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    loadingDiv.classList.add('hidden');
  }

  function showError() {
    contentDiv.classList.add('hidden');
    loadingDiv.classList.add('hidden');
    errorDiv.classList.remove('hidden');
  }

  function showLoading() {
    contentDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
  }

  function createAccountElement(account, index, isDefault) {
    const item = document.createElement('div');
    item.className = `account-row ${isDefault ? 'selected' : ''}`;
    item.dataset.index = index;
    item.dataset.email = account.email;

    const email = document.createElement('div');
    email.className = 'account-email';
    email.textContent = account.email;

    const indicator = document.createElement('div');
    indicator.className = `status-indicator ${isDefault ? 'default' : ''}`;

    item.appendChild(email);
    item.appendChild(indicator);

    item.addEventListener('click', () => {
      setDefaultAccount(index);
    });

    return item;
  }

  function renderAccounts() {
    while (accountsContainer.firstChild) {
      accountsContainer.removeChild(accountsContainer.firstChild);
    }

    accounts.forEach((account, index) => {
      const isDefault = account.email === defaultAccountEmail;
      const item = createAccountElement(account, index, isDefault);
      accountsContainer.appendChild(item);
    });
  }

  async function setDefaultAccount(index) {
    try {
      await chrome.runtime.sendMessage({
        action: 'setDefaultAccount',
        accountIndex: index,
      });
      // Update local state after successful save
      if (accounts[index]) {
        defaultAccountEmail = accounts[index].email;
      }
      renderAccounts(); // Re-render to update UI consistently
    } catch (error) {
      console.error('Error setting default account:', error);
      // Optionally, revert UI or show error to user
    }
  }

  async function loadAccounts() {
    showLoading();

    try {
      await refreshAccounts();
      if (accounts.length === 0) {
        showError();
      } else {
        await renderDefaultAccount();
        showContent();
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      showError();
    }
  }

  async function refreshAccounts() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'refreshAccounts',
      });
      if (response && response.success) {
        accounts = response.accounts || [];
      } else {
        console.error('Failed to refresh accounts:', response?.error);
        accounts = [];
      }
    } catch (error) {
      console.error('Error sending refreshAccounts message:', error);
      accounts = [];
    }
  }

  async function renderDefaultAccount() {
    if (accounts.length === 0) {
      showError();
      return;
    }

    try {
      const defaultResponse = await chrome.runtime.sendMessage({
        action: 'getDefaultAccount',
      });
      if (defaultResponse) {
        const defaultIndex = defaultResponse.defaultAccount || 0;
        if (defaultIndex >= 0 && defaultIndex < accounts.length) {
          defaultAccountEmail = accounts[defaultIndex].email;
        } else {
          defaultAccountEmail = accounts[0].email;
        }
      } else {
        console.error('Failed to get default account.');
        defaultAccountEmail = accounts[0].email;
      }
    } catch (error) {
      console.error('Error sending getDefaultAccount message:', error);
      defaultAccountEmail = accounts[0].email;
    }

    renderAccounts();
  }

  retryBtn.addEventListener('click', () => {
    loadAccounts();
  });

  function setupExternalLinks() {
    const reviewLink = document.getElementById('review-link');
    const coffeeLink = document.getElementById('coffee-link');

    const open = async url => {
      try {
        await chrome.tabs.create({ url });
      } catch (error) {
        console.error('Error opening link:', error);
      }
    };

    reviewLink?.addEventListener('click', e => {
      e.preventDefault();
      open(REVIEW_URL);
    });

    coffeeLink?.addEventListener('click', e => {
      e.preventDefault();
      open(COFFEE_URL);
    });
  }

  setupExternalLinks();
  loadAccounts();
});
