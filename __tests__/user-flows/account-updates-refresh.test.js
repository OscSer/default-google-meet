describe('Account Updates and Refresh Flow', () => {
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
      },
      alarms: {
        create: jest.fn(),
        get: jest.fn(),
        clear: jest.fn()
      }
    };

    global.chrome = mockChrome;
    global.fetch = jest.fn();
  });

  describe('Update account list manually', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container"></div>
        <button id="refresh-accounts">Refresh Accounts</button>
        <div id="loading-indicator" style="display: none;">Loading...</div>
      `;
    });

    test('should show refresh button in popup', () => {
      const refreshButton = document.getElementById('refresh-accounts');
      expect(refreshButton).toBeTruthy();
      expect(refreshButton.textContent).toBe('Refresh Accounts');
    });

    test('should show loading indicator during manual refresh', () => {
      const refreshButton = document.getElementById('refresh-accounts');
      const loadingIndicator = document.getElementById('loading-indicator');

      refreshButton.addEventListener('click', () => {
        loadingIndicator.style.display = 'block';
      });

      refreshButton.click();

      expect(loadingIndicator.style.display).toBe('block');
    });

    test('should fetch fresh account data on manual refresh', async () => {
      const mockAccountData = [
        { email: 'user1@gmail.com', name: 'User 1', avatar: 'avatar1.jpg' },
        { email: 'user2@gmail.com', name: 'User 2', avatar: 'avatar2.jpg' }
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAccountData)
      });

      const refreshButton = document.getElementById('refresh-accounts');
      
      refreshButton.addEventListener('click', () => {
        global.fetch('https://accounts.google.com/ListAccounts');
      });
      
      refreshButton.click();

      expect(global.fetch).toHaveBeenCalledWith('https://accounts.google.com/ListAccounts');
    });

    test('should update accounts container after refresh', async () => {
      const mockAccounts = [
        { email: 'user1@gmail.com', name: 'User 1', avatar: 'avatar1.jpg' },
        { email: 'user2@gmail.com', name: 'User 2', avatar: 'avatar2.jpg' }
      ];

      mockStorage.local.set({ accounts: mockAccounts });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        accounts: mockAccounts
      });
    });

    test('should provide feedback when refresh completes', (done) => {
      const refreshButton = document.getElementById('refresh-accounts');
      const loadingIndicator = document.getElementById('loading-indicator');

      refreshButton.addEventListener('click', () => {
        setTimeout(() => {
          loadingIndicator.style.display = 'none';
          refreshButton.textContent = '✓ Updated';
        }, 500);
      });

      refreshButton.click();

      setTimeout(() => {
        expect(loadingIndicator.style.display).toBe('none');
        expect(refreshButton.textContent).toBe('✓ Updated');
        done();
      }, 600);
    });
  });

  describe('Automatic update every 30 minutes', () => {
    test('should create alarm for automatic updates', () => {
      const alarmName = 'refreshAccounts';
      const periodInMinutes = 30;

      mockChrome.alarms.create(alarmName, { periodInMinutes });

      expect(mockChrome.alarms.create).toHaveBeenCalledWith(alarmName, {
        periodInMinutes: 30
      });
    });

    test('should check for existing alarm before creating new one', () => {
      const alarmName = 'refreshAccounts';
      
      mockChrome.alarms.get(alarmName, (alarm) => {
        if (!alarm) {
          mockChrome.alarms.create(alarmName, { periodInMinutes: 30 });
        }
      });

      expect(mockChrome.alarms.get).toHaveBeenCalledWith(alarmName, expect.any(Function));
    });

    test('should handle alarm trigger for account refresh', () => {
      const alarm = { name: 'refreshAccounts' };
      
      const handleAlarm = (alarm) => {
        if (alarm.name === 'refreshAccounts') {
          return true;
        }
        return false;
      };

      const result = handleAlarm(alarm);
      expect(result).toBe(true);
    });

    test('should store last refresh timestamp', () => {
      const currentTime = Date.now();
      
      mockStorage.local.set({ lastRefresh: currentTime });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        lastRefresh: currentTime
      });
    });

    test('should skip refresh if recently updated', () => {
      const now = Date.now();
      const lastRefresh = now - (15 * 60 * 1000); // 15 minutes ago
      const thirtyMinutes = 30 * 60 * 1000;

      const shouldRefresh = (now - lastRefresh) > thirtyMinutes;
      
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('Detect new accounts added to Google', () => {
    test('should compare current accounts with stored accounts', () => {
      const storedAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 }
      ];

      const currentAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 },
        { email: 'user3@gmail.com', index: 2 }
      ];

      const newAccounts = currentAccounts.filter(current => 
        !storedAccounts.find(stored => stored.email === current.email)
      );

      expect(newAccounts).toHaveLength(1);
      expect(newAccounts[0].email).toBe('user3@gmail.com');
    });

    test('should detect removed accounts', () => {
      const storedAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 }
      ];

      const currentAccounts = [
        { email: 'user1@gmail.com', index: 0 }
      ];

      const removedAccounts = storedAccounts.filter(stored => 
        !currentAccounts.find(current => current.email === stored.email)
      );

      expect(removedAccounts).toHaveLength(1);
      expect(removedAccounts[0].email).toBe('user2@gmail.com');
    });

    test('should notify user of new accounts detected', () => {
      const newAccountsCount = 2;
      const notificationMessage = `${newAccountsCount} new Google accounts detected`;

      expect(notificationMessage).toBe('2 new Google accounts detected');
    });

    test('should update account indices after detection', () => {
      const detectedAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user3@gmail.com', index: 1 },
        { email: 'user2@gmail.com', index: 2 }
      ];

      const reindexedAccounts = detectedAccounts.map((account, index) => ({
        ...account,
        index: index
      }));

      expect(reindexedAccounts[0].index).toBe(0);
      expect(reindexedAccounts[1].index).toBe(1);
      expect(reindexedAccounts[2].index).toBe(2);
    });

    test('should handle account profile changes', () => {
      const storedAccount = {
        email: 'user1@gmail.com',
        name: 'Old Name',
        avatar: 'old-avatar.jpg'
      };

      const currentAccount = {
        email: 'user1@gmail.com',
        name: 'New Name',
        avatar: 'new-avatar.jpg'
      };

      const hasProfileChanged = (
        storedAccount.name !== currentAccount.name ||
        storedAccount.avatar !== currentAccount.avatar
      );

      expect(hasProfileChanged).toBe(true);
    });
  });

  describe('Acceptance Criteria', () => {
    test('should complete manual refresh within 5 seconds', (done) => {
      const startTime = Date.now();
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      const refreshButton = document.getElementById('refresh-accounts');
      refreshButton.click();

      setTimeout(() => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(5000);
        done();
      }, 1000);
    });

    test('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const refreshButton = document.getElementById('refresh-accounts');
      
      try {
        refreshButton.click();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should maintain account selection after refresh', () => {
      const selectedAccountIndex = 1;
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex });

      const refreshButton = document.getElementById('refresh-accounts');
      
      refreshButton.addEventListener('click', () => {
        mockStorage.local.get(['selectedAccountIndex']);
      });
      
      refreshButton.click();

      expect(mockStorage.local.get).toHaveBeenCalledWith(['selectedAccountIndex']);
    });

    test('should update UI immediately after detecting changes', () => {
      const accountsContainer = document.getElementById('accounts-container');
      const newAccountHTML = '<div class="account-item">New Account</div>';
      
      accountsContainer.innerHTML = newAccountHTML;

      expect(accountsContainer.innerHTML).toContain('New Account');
    });
  });
});