// Popup script for Google Meet Extension
document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const contentDiv = document.getElementById('content');
    const errorDiv = document.getElementById('error');
    const defaultAccountInfo = document.getElementById('default-account-info');
    const accountsContainer = document.getElementById('accounts-container');
    const addAccountBtn = document.getElementById('add-account-btn');
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
        
        // Add click handler
        item.addEventListener('click', () => {
            setDefaultAccount(index);
        });
        
        return item;
    }
    
    // Function no longer needed - removed default account display
    
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
        
        // Update visual selection
        document.querySelectorAll('.account-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const indicator = item.querySelector('.status-indicator');
            indicator.className = `status-indicator ${i === index ? 'default' : ''}`;
        });
        
        // Save to storage
        chrome.runtime.sendMessage({
            action: 'setDefaultAccount',
            accountIndex: index
        }, (response) => {
            // Account saved
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
                
                // If no accounts exist, automatically start add account flow
                if (accounts.length === 0) {
                    console.log('No accounts found, starting add account flow');
                    addAccount();
                    return;
                }
                
                loadDefaultAccountAndRender();
            } else {
                showError();
            }
        });
    }
    
    // Add a new account
    function addAccount() {
        showLoading();
        
        chrome.runtime.sendMessage({action: 'addAccount'}, (response) => {
            if (chrome.runtime.lastError) {
                showError();
                return;
            }
            
            if (response && response.success) {
                // Reload accounts to show the new one
                loadAccounts();
            } else {
                showError();
                console.error('Error adding account:', response.error);
            }
        });
    }
    
    // Remove an account
    function removeAccount(index) {
        showLoading();
        
        chrome.runtime.sendMessage({
            action: 'removeAccount',
            accountIndex: index
        }, (response) => {
            if (chrome.runtime.lastError) {
                showError();
                return;
            }
            
            if (response && response.success) {
                // Reload accounts to reflect the change
                loadAccounts();
            } else {
                showError();
                console.error('Error removing account:', response.error);
            }
        });
    }
    
    // Load default account and render
    function loadDefaultAccountAndRender() {
        chrome.runtime.sendMessage({action: 'getDefaultAccount'}, (defaultResponse) => {
            if (chrome.runtime.lastError) {
                defaultAccountIndex = 0;
            } else if (defaultResponse) {
                defaultAccountIndex = defaultResponse.defaultAccount || 0;
                // Make sure the index is valid
                if (defaultAccountIndex >= accounts.length) {
                    defaultAccountIndex = 0;
                }
            }
            
            renderAccounts();
            showContent();
        });
    }
    
    // Event listeners
    addAccountBtn.addEventListener('click', addAccount);
    retryBtn.addEventListener('click', loadAccounts);
    
    // Initialize
    loadAccounts();
});