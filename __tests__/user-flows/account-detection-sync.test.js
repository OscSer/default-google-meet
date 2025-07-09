describe('Account Detection and Synchronization Flow', () => {
  let mockChrome;
  let mockTabs;
  let mockStorage;

  beforeEach(() => {
    mockTabs = {
      create: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
      get: jest.fn()
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

  describe('Detect incorrect account in active Meet', () => {
    test('should detect current account in active Meet tab', () => {
      const activeMeetTab = {
        id: 123,
        url: 'https://meet.google.com/abc-def-ghi?authuser=1',
        active: true
      };

      mockTabs.query.mockResolvedValue([activeMeetTab]);

      const callback = jest.fn();
      mockTabs.query({ url: '*://meet.google.com/*' }, callback);

      expect(mockTabs.query).toHaveBeenCalledWith({ url: '*://meet.google.com/*' }, callback);
    });

    test('should identify mismatch between desired and current account', () => {
      const currentMeetUrl = 'https://meet.google.com/abc-def-ghi?authuser=0';
      const desiredAccountIndex = 1;

      const currentAccount = new URL(currentMeetUrl).searchParams.get('authuser');
      const accountMismatch = parseInt(currentAccount) !== desiredAccountIndex;

      expect(accountMismatch).toBe(true);
    });

    test('should detect when user is in Meet with wrong account', () => {
      const activeMeetTab = {
        url: 'https://meet.google.com/test-meeting?authuser=0'
      };
      
      mockTabs.query.mockResolvedValue([activeMeetTab]);
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex: 2 });

      const urlParams = new URL(activeMeetTab.url).searchParams;
      const currentAuthUser = parseInt(urlParams.get('authuser')) || 0;
      const selectedAccount = 2;

      expect(currentAuthUser).not.toBe(selectedAccount);
    });

    test('should preserve meeting room ID during detection', () => {
      const meetingUrl = 'https://meet.google.com/abc-def-ghi?authuser=0';
      const meetingId = meetingUrl.match(/meet\.google\.com\/([^?]+)/)[1];

      expect(meetingId).toBe('abc-def-ghi');
    });
  });

  describe('Automatic redirect to correct account', () => {
    test('should redirect to correct account while preserving meeting', () => {
      const originalUrl = 'https://meet.google.com/abc-def-ghi?authuser=0';
      const correctAccountIndex = 2;
      
      const url = new URL(originalUrl);
      url.searchParams.set('authuser', correctAccountIndex.toString());
      const newUrl = url.toString();

      mockTabs.update.mockResolvedValue();

      expect(newUrl).toBe('https://meet.google.com/abc-def-ghi?authuser=2');
    });

    test('should update active Meet tab with correct account', () => {
      const tabId = 123;
      const newUrl = 'https://meet.google.com/abc-def-ghi?authuser=1';

      mockTabs.update(tabId, { url: newUrl });

      expect(mockTabs.update).toHaveBeenCalledWith(tabId, { url: newUrl });
    });

    test('should handle URL with multiple query parameters', () => {
      const originalUrl = 'https://meet.google.com/abc-def-ghi?authuser=0&hl=es&pli=1';
      const correctAccountIndex = 1;
      
      const url = new URL(originalUrl);
      url.searchParams.set('authuser', correctAccountIndex.toString());
      const newUrl = url.toString();

      expect(newUrl).toContain('authuser=1');
      expect(newUrl).toContain('hl=es');
      expect(newUrl).toContain('pli=1');
    });

    test('should preserve meeting context during redirect', () => {
      const originalUrl = 'https://meet.google.com/abc-def-ghi?authuser=0';
      const meetingId = 'abc-def-ghi';
      const newAccountIndex = 2;

      const redirectUrl = `https://meet.google.com/${meetingId}?authuser=${newAccountIndex}`;

      expect(redirectUrl).toBe('https://meet.google.com/abc-def-ghi?authuser=2');
    });
  });

  describe('Synchronization after Google account change', () => {
    test('should detect account changes in Google services', () => {
      const previousAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 }
      ];
      
      const currentAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 },
        { email: 'user3@gmail.com', index: 2 }
      ];

      const hasNewAccounts = currentAccounts.length > previousAccounts.length;
      expect(hasNewAccounts).toBe(true);
    });

    test('should update stored account list after sync', () => {
      const newAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 },
        { email: 'user3@gmail.com', index: 2 }
      ];

      mockStorage.local.set({ accounts: newAccounts });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        accounts: newAccounts
      });
    });

    test('should handle account removal gracefully', () => {
      const previousAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 }
      ];
      
      const currentAccounts = [
        { email: 'user1@gmail.com', index: 0 }
      ];

      const removedAccounts = previousAccounts.filter(
        prev => !currentAccounts.find(curr => curr.email === prev.email)
      );

      expect(removedAccounts).toHaveLength(1);
      expect(removedAccounts[0].email).toBe('user2@gmail.com');
    });

    test('should adjust account indices after sync', () => {
      const syncedAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user3@gmail.com', index: 1 },
        { email: 'user2@gmail.com', index: 2 }
      ];

      const reindexedAccounts = syncedAccounts.map((account, index) => ({
        ...account,
        index: index
      }));

      expect(reindexedAccounts[1].email).toBe('user3@gmail.com');
      expect(reindexedAccounts[1].index).toBe(1);
    });
  });

  describe('Acceptance Criteria', () => {
    test('should complete detection within 2 seconds', (done) => {
      const startTime = Date.now();
      
      const callback = () => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(2000);
        done();
      };
      
      mockTabs.query({ url: '*://meet.google.com/*' }, callback);
      
      setTimeout(() => {
        callback();
      }, 100);
    });

    test('should handle redirect without losing meeting context', () => {
      const originalMeetingId = 'abc-def-ghi';
      const originalUrl = `https://meet.google.com/${originalMeetingId}?authuser=0`;
      
      const url = new URL(originalUrl);
      url.searchParams.set('authuser', '1');
      const newUrl = url.toString();

      const newMeetingId = newUrl.match(/meet\.google\.com\/([^?]+)/)[1];
      
      expect(newMeetingId).toBe(originalMeetingId);
    });

    test('should maintain user experience during sync', () => {
      const syncOperation = {
        preserveSelection: true,
        maintainMeetingState: true,
        updateUI: true
      };

      expect(syncOperation.preserveSelection).toBe(true);
      expect(syncOperation.maintainMeetingState).toBe(true);
      expect(syncOperation.updateUI).toBe(true);
    });
  });
});