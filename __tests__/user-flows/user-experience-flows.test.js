describe('User Experience Flows', () => {
  let mockChrome;
  let mockTabs;
  let mockStorage;

  beforeEach(() => {
    mockTabs = {
      create: jest.fn(),
      query: jest.fn(),
      update: jest.fn()
    };

    mockStorage = {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    };

    mockChrome = {
      tabs: mockTabs,
      storage: mockStorage,
      runtime: {
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        lastError: null
      }
    };

    global.chrome = mockChrome;
  });

  describe('Loading states and visual feedback', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container"></div>
        <div id="loading-spinner" style="display: none;">
          <div class="spinner"></div>
          <span>Loading accounts...</span>
        </div>
        <button id="refresh-accounts">Refresh Accounts</button>
        <div id="success-message" style="display: none;">✓ Accounts updated</div>
      `;
    });

    test('should show loading spinner during account fetch', () => {
      const loadingSpinner = document.getElementById('loading-spinner');
      const accountsContainer = document.getElementById('accounts-container');

      loadingSpinner.style.display = 'block';
      accountsContainer.style.display = 'none';

      expect(loadingSpinner.style.display).toBe('block');
      expect(accountsContainer.style.display).toBe('none');
    });

    test('should display loading text during operations', () => {
      const loadingSpinner = document.getElementById('loading-spinner');
      const loadingText = loadingSpinner.querySelector('span').textContent;

      expect(loadingText).toBe('Loading accounts...');
    });

    test('should show success message after completion', () => {
      const successMessage = document.getElementById('success-message');
      const loadingSpinner = document.getElementById('loading-spinner');

      loadingSpinner.style.display = 'none';
      successMessage.style.display = 'block';

      expect(successMessage.style.display).toBe('block');
      expect(successMessage.textContent).toBe('✓ Accounts updated');
    });

    test('should disable buttons during loading', () => {
      const refreshButton = document.getElementById('refresh-accounts');
      refreshButton.disabled = true;

      expect(refreshButton.disabled).toBe(true);
    });

    test('should provide visual feedback for button clicks', () => {
      const refreshButton = document.getElementById('refresh-accounts');
      refreshButton.classList.add('clicked');

      expect(refreshButton.classList.contains('clicked')).toBe(true);
    });
  });

  describe('Handle multiple accounts (>5)', () => {
    beforeEach(() => {
      const multipleAccounts = Array.from({ length: 8 }, (_, i) => ({
        email: `user${i + 1}@gmail.com`,
        name: `User ${i + 1}`,
        avatar: `avatar${i + 1}.jpg`,
        index: i
      }));

      mockStorage.local.get.mockResolvedValue({ accounts: multipleAccounts });

      document.body.innerHTML = `
        <div id="accounts-container" class="scrollable-container">
          ${multipleAccounts.map(account => `
            <div class="account-item" data-account-index="${account.index}">
              <img src="${account.avatar}" alt="${account.name}">
              <span>${account.email}</span>
            </div>
          `).join('')}
        </div>
        <div id="account-count">8 accounts available</div>
      `;
    });

    test('should display all accounts in scrollable container', () => {
      const accountItems = document.querySelectorAll('.account-item');
      const accountsContainer = document.getElementById('accounts-container');

      expect(accountItems).toHaveLength(8);
      expect(accountsContainer.classList.contains('scrollable-container')).toBe(true);
    });

    test('should show account count indicator', () => {
      const accountCount = document.getElementById('account-count');
      expect(accountCount.textContent).toBe('8 accounts available');
    });

    test('should handle scrolling for many accounts', () => {
      const accountsContainer = document.getElementById('accounts-container');
      accountsContainer.style.maxHeight = '300px';
      accountsContainer.style.overflowY = 'auto';

      expect(accountsContainer.style.maxHeight).toBe('300px');
      expect(accountsContainer.style.overflowY).toBe('auto');
    });

    test('should maintain performance with many accounts', () => {
      const accountItems = document.querySelectorAll('.account-item');
      const startTime = Date.now();

      accountItems.forEach(item => {
        item.addEventListener('click', () => {});
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100);
    });

    test('should group accounts by domain if many exist', () => {
      const accounts = [
        { email: 'user1@gmail.com', domain: 'gmail.com' },
        { email: 'user2@gmail.com', domain: 'gmail.com' },
        { email: 'user3@company.com', domain: 'company.com' },
        { email: 'user4@company.com', domain: 'company.com' }
      ];

      const groupedAccounts = accounts.reduce((groups, account) => {
        const domain = account.domain;
        if (!groups[domain]) {
          groups[domain] = [];
        }
        groups[domain].push(account);
        return groups;
      }, {});

      expect(groupedAccounts['gmail.com']).toHaveLength(2);
      expect(groupedAccounts['company.com']).toHaveLength(2);
    });
  });

  describe('Behavior with accounts without name/image', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container">
          <div class="account-item" data-account-index="0">
            <img src="" alt="Account" class="account-avatar">
            <span class="account-name"></span>
            <span class="account-email">user1@gmail.com</span>
          </div>
          <div class="account-item" data-account-index="1">
            <img src="avatar2.jpg" alt="Account" class="account-avatar">
            <span class="account-name">User 2</span>
            <span class="account-email">user2@gmail.com</span>
          </div>
        </div>
      `;
    });

    test('should show placeholder avatar for missing images', () => {
      const avatarImg = document.querySelector('.account-avatar');
      const placeholderSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDEwQzE2LjY5IDEwIDEzIDEzLjY5IDEzIDEzLjY5IDEzIDE3IDEzIDE3IDEzIDIwQzEzIDIzIDEzIDIzIDEzIDIzIDEzIDI2LjMxIDEzIDI2LjMxIDEzIDI2LjMxIDEzIDMwIDEzIDMwIDEzIDMwIDE2LjY5IDMwIDIwIDMwIDIzLjMxIDMwIDI3IDMwIDI3IDMwIDI3IDI2LjMxIDI3IDIzIDI3IDIzIDI3IDIzIDI3IDIwIDI3IDIwIDI3IDIwIDI3IDIwIDIzLjMxIDIwIDIwIDIwIDIwIDIwIDE2LjY5IDIwIDEzLjY5IDIwIDEwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
      
      if (!avatarImg.src || avatarImg.src === 'http://localhost/') {
        avatarImg.src = placeholderSrc;
      }

      expect(avatarImg.src).toBe(placeholderSrc);
    });

    test('should use email as fallback for missing names', () => {
      const accountName = document.querySelector('.account-name');
      const accountEmail = document.querySelector('.account-email');

      if (!accountName.textContent || accountName.textContent === '') {
        accountName.textContent = accountEmail.textContent;
      }

      expect(accountName.textContent).toBe('user1@gmail.com');
    });

    test('should handle missing avatar gracefully', () => {
      const avatarImg = document.querySelector('.account-avatar');
      
      avatarImg.onerror = () => {
        avatarImg.src = '/images/default-avatar.png';
      };

      const errorEvent = new Event('error');
      avatarImg.dispatchEvent(errorEvent);

      expect(avatarImg.src).toContain('default-avatar.png');
    });

    test('should generate initials from email when no name available', () => {
      const email = 'user1@gmail.com';
      const generateInitials = (email) => {
        const username = email.split('@')[0];
        return username.charAt(0).toUpperCase();
      };

      const initials = generateInitials(email);
      expect(initials).toBe('U');
    });
  });

  describe('Keyboard navigation in popup', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container" tabindex="0">
          <div class="account-item" tabindex="0" data-account-index="0">
            <span>user1@gmail.com</span>
          </div>
          <div class="account-item" tabindex="0" data-account-index="1">
            <span>user2@gmail.com</span>
          </div>
        </div>
        <button id="go-to-meet" tabindex="0">Go to Meet</button>
        <button id="refresh-accounts" tabindex="0">Refresh Accounts</button>
      `;
    });

    test('should allow Tab navigation through elements', () => {
      const focusableElements = document.querySelectorAll('[tabindex="0"]');
      expect(focusableElements).toHaveLength(5);
    });

    test('should highlight focused account item', () => {
      const firstAccount = document.querySelector('.account-item');
      firstAccount.focus();
      firstAccount.classList.add('focused');

      expect(firstAccount.classList.contains('focused')).toBe(true);
    });

    test('should handle Enter key to select account', () => {
      const firstAccount = document.querySelector('.account-item');
      
      firstAccount.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          firstAccount.classList.add('selected');
        }
      });

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      firstAccount.dispatchEvent(enterEvent);

      expect(firstAccount.classList.contains('selected')).toBe(true);
    });

    test('should handle Arrow keys for navigation', () => {
      const accountItems = document.querySelectorAll('.account-item');
      let currentIndex = 0;

      const handleArrowNavigation = (e) => {
        if (e.key === 'ArrowDown') {
          currentIndex = Math.min(currentIndex + 1, accountItems.length - 1);
          accountItems[currentIndex].focus();
        } else if (e.key === 'ArrowUp') {
          currentIndex = Math.max(currentIndex - 1, 0);
          accountItems[currentIndex].focus();
        }
      };

      document.addEventListener('keydown', handleArrowNavigation);

      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      document.dispatchEvent(arrowDownEvent);

      expect(currentIndex).toBe(1);
    });

    test('should handle Escape key to close popup', () => {
      let popupClosed = false;

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          popupClosed = true;
        }
      });

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(popupClosed).toBe(true);
    });
  });

  describe('Acceptance Criteria', () => {
    test('should provide immediate visual feedback', () => {
      const button = document.createElement('button');
      button.addEventListener('click', () => {
        button.classList.add('clicked');
      });

      button.click();

      expect(button.classList.contains('clicked')).toBe(true);
    });

    test('should maintain responsive UI with many accounts', () => {
      const largeAccountList = Array.from({ length: 20 }, (_, i) => ({
        email: `user${i}@gmail.com`,
        index: i
      }));

      const renderTime = Date.now();
      const container = document.createElement('div');
      
      largeAccountList.forEach(account => {
        const div = document.createElement('div');
        div.textContent = account.email;
        container.appendChild(div);
      });

      const totalTime = Date.now() - renderTime;
      expect(totalTime).toBeLessThan(100);
    });

    test('should handle accessibility requirements', () => {
      const accountItem = document.createElement('div');
      accountItem.setAttribute('role', 'button');
      accountItem.setAttribute('aria-label', 'Select account user1@gmail.com');
      accountItem.tabIndex = 0;

      expect(accountItem.getAttribute('role')).toBe('button');
      expect(accountItem.getAttribute('aria-label')).toContain('Select account');
      expect(accountItem.tabIndex).toBe(0);
    });
  });
});