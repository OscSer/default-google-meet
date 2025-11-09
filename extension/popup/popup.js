document.addEventListener('DOMContentLoaded', function () {
  const contentDiv = document.getElementById('main-content');
  const errorDiv = document.getElementById('error-message');
  const loadingDiv = document.getElementById('loading-spinner');
  const accountsContainer = document.getElementById('accounts-container');
  const retryBtn = document.getElementById('refresh-button');

  const REVIEW_URL =
    'https://chromewebstore.google.com/detail/google-meet-selector/kgejkghcnljcmpfnncbggbpioinaekfo/reviews';
  const COFFEE_URL = 'https://buymeacoffee.com/oserna';

  let accounts = [];
  let defaultAccountEmail = null;
  let selectingIndex = null;

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
    const classes = ['account-row'];
    if (isDefault) classes.push('selected');
    if (index === selectingIndex) classes.push('loading');
    item.className = classes.join(' ');
    item.dataset.index = index;
    item.dataset.email = account.email;

    const email = document.createElement('div');
    email.className = 'account-email';
    email.textContent = account.email;

    const indicator = document.createElement('div');
    const isLoading = index === selectingIndex;
    indicator.className = `status-indicator ${isLoading ? 'loading' : isDefault ? 'default' : ''}`;

    item.appendChild(email);
    item.appendChild(indicator);

    item.addEventListener('click', () => {
      if (selectingIndex !== null) return;
      selectingIndex = index;
      renderAccounts();
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
      if (accounts[index]) {
        defaultAccountEmail = accounts[index].email;
      }
    } catch (error) {
      console.error('Error setting default account:', error);
    } finally {
      selectingIndex = null;
      renderAccounts();
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
    const reviewLink = document.getElementById('store-review-link');
    const coffeeLink = document.getElementById('support-link');

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
