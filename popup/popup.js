// Popup script for Google Meet Extension
document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const contentDiv = document.getElementById('content');
    const errorDiv = document.getElementById('error');
    const accountsContainer = document.getElementById('accounts-container');
    const refreshAccountsBtn = document.getElementById('refresh-accounts-btn');
    const retryBtn = document.getElementById('retry-btn');
    
    let accounts = [];
    let defaultAccountIndex = 0;
    
    // Show loading state
    function showLoading() {
        loadingDiv.classList.remove('hidden');
        contentDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
    }
    
    // Show content
    function showContent() {
        loadingDiv.classList.add('hidden');
        contentDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
    }
    
    // Show error
    function showError() {
        loadingDiv.classList.add('hidden');
        contentDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
    
    // Create account item element
    function createAccountItem(account, index, isDefault) {
        const item = document.createElement('div');
        item.className = `account-item ${isDefault ? 'selected' : ''}`;
        item.dataset.index = index;
        
        const email = document.createElement('div');
        email.className = 'account-email';
        email.textContent = account.email;
        
        const indicator = document.createElement('div');
        indicator.className = `status-indicator ${isDefault ? 'default' : ''}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove account';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeAccount(index);
        });
        
        item.appendChild(email);
        item.appendChild(indicator);
        item.appendChild(removeBtn);
        
        item.addEventListener('click', () => {
            setDefaultAccount(index);
        });
        
        return item;
    }
    
    // Render accounts list
    function renderAccounts() {
        accountsContainer.innerHTML = '';
        
        accounts.forEach((account, arrayIndex) => {
            const item = createAccountItem(account, arrayIndex, arrayIndex === defaultAccountIndex);
            accountsContainer.appendChild(item);
        });
    }
    
    // Set default account
    function setDefaultAccount(index) {
        defaultAccountIndex = index;
        
        document.querySelectorAll('.account-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const indicator = item.querySelector('.status-indicator');
            indicator.className = `status-indicator ${i === index ? 'default' : ''}`;
        });
        
        chrome.runtime.sendMessage({
            action: 'setDefaultAccount',
            accountIndex: index
        });
    }
    
    // Load accounts from storage
    function loadAccounts() {
        showLoading();
        
        chrome.runtime.sendMessage({action: 'getAccounts'}, (response) => {
            if (chrome.runtime.lastError) {
                showError();
                return;
            }
            
            if (response && response.accounts) {
                accounts = response.accounts;
                
                if (accounts.length === 0) {
                    showError();
                    return;
                }
                
                loadDefaultAccountAndRender();
            } else {
                showError();
            }
        });
    }
    
    // Refresh accounts from browser session
    function refreshAccounts() {
        showLoading();
        chrome.runtime.sendMessage({action: 'refreshAccounts'}, (response) => {
            if (chrome.runtime.lastError || !response.success) {
                console.error("Failed to refresh accounts:", chrome.runtime.lastError || response.error);
                showError();
                return;
            }
            // After refreshing, reload the accounts to display them
            loadAccounts();
        });
    }

    // Remove an account
    function removeAccount(index) {
        showLoading();
        
        chrome.runtime.sendMessage({
            action: 'removeAccount',
            accountIndex: index
        }, (response) => {
            if (chrome.runtime.lastError || !response.success) {
                showError();
                return;
            }
            loadAccounts();
        });
    }
    
    // Load default account and render
    function loadDefaultAccountAndRender() {
        chrome.runtime.sendMessage({action: 'getDefaultAccount'}, (defaultResponse) => {
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
        });
    }
    
    // Event listeners
    refreshAccountsBtn.addEventListener('click', refreshAccounts);
    retryBtn.addEventListener('click', refreshAccounts);
    
    // Initialize
    loadAccounts();
});
