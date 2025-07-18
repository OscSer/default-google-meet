document.addEventListener('DOMContentLoaded', function () {
  const contentDiv = document.getElementById('content');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');
  const accountsContainer = document.getElementById('accounts-container');
  const retryBtn = document.getElementById('retry-btn');

  let accounts = [];
  let defaultAccountIndex = 0;

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
    accountsContainer.innerHTML = '';

    accounts.forEach((account, index) => {
      const item = createAccountElement(
        account,
        index,
        index === defaultAccountIndex
      );
      accountsContainer.appendChild(item);
    });
  }

  async function setDefaultAccount(index) {
    defaultAccountIndex = index;

    try {
      await chrome.runtime.sendMessage({
        action: 'setDefaultAccount',
        accountIndex: index,
      });
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
        defaultAccountIndex = defaultResponse.defaultAccount || 0;
        if (defaultAccountIndex >= accounts.length) {
          defaultAccountIndex = 0;
        }
      } else {
        console.error('Failed to get default account.');
        defaultAccountIndex = 0;
      }
    } catch (error) {
      console.error('Error sending getDefaultAccount message:', error);
      defaultAccountIndex = 0;
    }

    renderAccounts();
  }

  retryBtn.addEventListener('click', () => {
    loadAccounts();
  });

  loadAccounts();
});
