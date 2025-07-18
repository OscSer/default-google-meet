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

  function setDefaultAccount(index) {
    defaultAccountIndex = index;

    document.querySelectorAll('.account-row').forEach((item, i) => {
      item.classList.toggle('selected', i === index);
      const indicator = item.querySelector('.status-indicator');
      indicator.className = `status-indicator ${i === index ? 'default' : ''}`;
    });

    chrome.runtime.sendMessage({
      action: 'setDefaultAccount',
      accountIndex: index,
    });
  }

  function loadAccounts() {
    showLoading();

    refreshAccounts().then(() => {
      setTimeout(() => {
        if (accounts.length === 0) {
          showError();
        } else {
          renderDefaultAccount();
        }
      }, 500);
    });
  }

  function refreshAccounts() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'refreshAccounts' }, response => {
        if (chrome.runtime.lastError || !response.success) {
          resolve();
          return;
        }

        accounts = response.accounts || [];
        resolve();
      });
    });
  }

  function renderDefaultAccount() {
    if (accounts.length === 0) {
      showError();
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'getDefaultAccount' },
      defaultResponse => {
        if (chrome.runtime.lastError) {
          defaultAccountIndex = 0;
        } else if (defaultResponse) {
          defaultAccountIndex = defaultResponse.defaultAccount || 0;
          if (defaultAccountIndex >= accounts.length) {
            defaultAccountIndex = 0;
          }
        }

        renderAccounts();
        showContent();
      }
    );
  }

  retryBtn.addEventListener('click', () => {
    loadAccounts();
  });

  loadAccounts();
});
