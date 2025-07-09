// Popup script for Google Meet Extension
document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const contentDiv = document.getElementById('content');
    const errorDiv = document.getElementById('error');
    const defaultAccountInfo = document.getElementById('default-account-info');
    const accountsContainer = document.getElementById('accounts-container');
    const refreshBtn = document.getElementById('refresh-btn');
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
        
        const avatar = document.createElement('div');
        avatar.className = 'account-avatar';
        if (account.profilePicture) {
            avatar.style.backgroundImage = `url(${account.profilePicture})`;
        }
        
        const details = document.createElement('div');
        details.className = 'account-details';
        
        const name = document.createElement('div');
        name.className = 'account-name';
        name.textContent = account.name;
        
        const email = document.createElement('div');
        email.className = 'account-email';
        email.textContent = account.email;
        
        details.appendChild(name);
        details.appendChild(email);
        
        const indicator = document.createElement('div');
        indicator.className = `status-indicator ${isDefault ? 'default' : ''}`;
        
        item.appendChild(avatar);
        item.appendChild(details);
        item.appendChild(indicator);
        
        // Add click handler
        item.addEventListener('click', () => {
            setDefaultAccount(index);
        });
        
        return item;
    }
    
    // Update default account display
    function updateDefaultAccountDisplay() {
        if (accounts.length === 0) {
            defaultAccountInfo.querySelector('.account-name').textContent = 'Not set';
            defaultAccountInfo.querySelector('.account-email').textContent = 'Please select a default account';
            defaultAccountInfo.querySelector('.account-avatar').style.backgroundImage = '';
            return;
        }
        
        const account = accounts[defaultAccountIndex];
        if (account) {
            defaultAccountInfo.querySelector('.account-name').textContent = account.name;
            defaultAccountInfo.querySelector('.account-email').textContent = account.email;
            
            const avatar = defaultAccountInfo.querySelector('.account-avatar');
            if (account.profilePicture) {
                avatar.style.backgroundImage = `url(${account.profilePicture})`;
            } else {
                avatar.style.backgroundImage = '';
            }
        }
    }
    
    // Render accounts list
    function renderAccounts() {
        accountsContainer.innerHTML = '';
        
        accounts.forEach((account, arrayIndex) => {
            const item = createAccountItem(account, arrayIndex, arrayIndex === defaultAccountIndex);
            accountsContainer.appendChild(item);
        });
        
        updateDefaultAccountDisplay();
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
        
        // Update default account display
        updateDefaultAccountDisplay();
        
        // Save to storage
        chrome.runtime.sendMessage({
            action: 'setDefaultAccount',
            accountIndex: index
        }, (response) => {
            // Account saved
        });
    }
    
    // Load accounts from background script
    function loadAccounts() {
        showLoading();
        
        // Get accounts with timeout
        const timeoutId = setTimeout(() => {
            showError();
        }, 30000);
        
        chrome.runtime.sendMessage({action: 'getAccounts'}, (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
                showError();
                return;
            }
            
            if (response && response.accounts && response.accounts.length > 0) {
                accounts = response.accounts;
                
                // Get default account
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
            } else {
                showError();
            }
        });
    }
    
    // Refresh accounts using Identity API
    function refreshAccounts() {
        showLoading();
        
        chrome.runtime.sendMessage({action: 'refreshAccounts'}, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError.message);
                showError();
                return;
            }
            
            if (response && response.error) {
                console.error('Refresh error:', response.error);
                showError();
                return;
            }
            
            if (response && response.accounts && response.accounts.length > 0) {
                accounts = response.accounts;
                
                // Get default account
                chrome.runtime.sendMessage({action: 'getDefaultAccount'}, (defaultResponse) => {
                    if (defaultResponse) {
                        defaultAccountIndex = defaultResponse.defaultAccount || 0;
                        if (defaultAccountIndex >= accounts.length) {
                            defaultAccountIndex = 0;
                        }
                    }
                    
                    renderAccounts();
                    showContent();
                });
            } else {
                console.error('No accounts returned or empty response');
                showError();
            }
        });
    }
    
    // Event listeners
    refreshBtn.addEventListener('click', refreshAccounts);
    retryBtn.addEventListener('click', loadAccounts);
    
    // Initialize
    loadAccounts();
});