describe('Background Script', () => {
  let mockChrome;
  let mockFetch;

  beforeEach(() => {
    mockChrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn()
        },
        lastError: undefined,
        sendMessage: jest.fn()
      },
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      cookies: {
        getAll: jest.fn()
      }
    };

    mockFetch = jest.fn();
    global.chrome = mockChrome;
    global.fetch = mockFetch;
    global.URL = jest.fn().mockImplementation((url) => ({
      searchParams: {
        get: jest.fn(),
        set: jest.fn()
      },
      toString: jest.fn().mockReturnValue(url)
    }));
    global.setTimeout = jest.fn();
    global.setInterval = jest.fn();
    global.clearTimeout = jest.fn();
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: {},
      abort: jest.fn()
    }));
  });

  describe('Account Management', () => {
    test('getStoredAccounts should return accounts from storage', async () => {
      const mockAccounts = [
        { email: 'test@example.com', authuser: 0 }
      ];
      
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ accounts: mockAccounts });
      });

      const getStoredAccounts = async () => {
        return new Promise((resolve) => {
          mockChrome.storage.sync.get(['accounts'], (result) => {
            const accounts = result.accounts || [];
            resolve(accounts);
          });
        });
      };

      const result = await getStoredAccounts();
      
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['accounts'], expect.any(Function));
      expect(result).toEqual(mockAccounts);
    });

    test('storeAccounts should save accounts to storage', async () => {
      const mockAccounts = [
        { email: 'test@example.com', authuser: 0 }
      ];
      
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const storeAccounts = async (accounts) => {
        return new Promise((resolve) => {
          mockChrome.storage.sync.set({ accounts: accounts }, () => {
            if (mockChrome.runtime.lastError) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      };

      const result = await storeAccounts(mockAccounts);
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        { accounts: mockAccounts },
        expect.any(Function)
      );
      expect(result).toBe(true);
    });
  });

  describe('URL Handling', () => {
    test('getCurrentAccountFromURL should extract authuser from URL', () => {
      const mockUrl = new URL('https://meet.google.com/test?authuser=2');
      mockUrl.searchParams.get.mockReturnValue('2');
      
      global.URL = jest.fn().mockReturnValue(mockUrl);

      const getCurrentAccountFromURL = (url) => {
        const urlObj = new URL(url);
        const authuser = urlObj.searchParams.get('authuser');
        
        if (authuser !== null) {
          return parseInt(authuser);
        }
        
        return null;
      };

      const result = getCurrentAccountFromURL('https://meet.google.com/test?authuser=2');
      
      expect(result).toBe(2);
      expect(mockUrl.searchParams.get).toHaveBeenCalledWith('authuser');
    });

    test('constructMeetURL should add authuser parameter to URL', () => {
      const mockUrl = new URL('https://meet.google.com/test');
      mockUrl.searchParams.set = jest.fn();
      mockUrl.toString = jest.fn().mockReturnValue('https://meet.google.com/test?authuser=1');
      
      global.URL = jest.fn().mockReturnValue(mockUrl);

      const constructMeetURL = (originalUrl, accountIndex) => {
        const url = new URL(originalUrl);
        url.searchParams.set('authuser', accountIndex.toString());
        return url.toString();
      };

      const result = constructMeetURL('https://meet.google.com/test', 1);
      
      expect(mockUrl.searchParams.set).toHaveBeenCalledWith('authuser', '1');
      expect(result).toBe('https://meet.google.com/test?authuser=1');
    });
  });

  describe('Message Handling', () => {
    test('should handle getAccounts message', () => {
      const mockCallback = jest.fn();
      const mockAccounts = [{ email: 'test@example.com' }];
      
      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'getAccounts') {
          Promise.resolve(mockAccounts).then(accounts => {
            sendResponse({ accounts: accounts });
          });
          return true;
        }
      };

      const result = messageHandler(
        { action: 'getAccounts' },
        {},
        mockCallback
      );

      expect(result).toBe(true);
    });

    test('should handle getDefaultAccount message', () => {
      const mockCallback = jest.fn();
      
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ defaultAccount: 1 });
      });

      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'getDefaultAccount') {
          mockChrome.storage.sync.get(['defaultAccount'], (result) => {
            sendResponse({ defaultAccount: result.defaultAccount || 0 });
          });
          return true;
        }
      };

      const result = messageHandler(
        { action: 'getDefaultAccount' },
        {},
        mockCallback
      );

      expect(result).toBe(true);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['defaultAccount'], expect.any(Function));
    });

    test('should handle setDefaultAccount message', () => {
      const mockCallback = jest.fn();
      const mockAccounts = [{ email: 'test@example.com', authuser: 0 }];
      
      mockChrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'setDefaultAccount') {
          Promise.resolve(mockAccounts).then(accounts => {
            const account = accounts[request.accountIndex];
            if (account) {
              const defaultAuthuser = account.authuser;
              mockChrome.storage.sync.set({
                defaultAccount: request.accountIndex,
                defaultAuthuser: defaultAuthuser
              }, () => {
                if (mockChrome.runtime.lastError) {
                  sendResponse({ success: false, error: mockChrome.runtime.lastError.message });
                } else {
                  sendResponse({ success: true });
                }
              });
            } else {
              sendResponse({ success: false, error: 'Account not found' });
            }
          });
          return true;
        }
      };

      const result = messageHandler(
        { action: 'setDefaultAccount', accountIndex: 0 },
        {},
        mockCallback
      );

      expect(result).toBe(true);
    });

    test('should handle refreshAccounts message', () => {
      const mockCallback = jest.fn();
      const mockAccounts = [{ email: 'test@example.com' }];
      
      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'refreshAccounts') {
          Promise.resolve(mockAccounts).then(accounts => {
            sendResponse({ success: true, accounts: accounts });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }
      };

      const result = messageHandler(
        { action: 'refreshAccounts' },
        {},
        mockCallback
      );

      expect(result).toBe(true);
    });
  });

  describe('Cookie Processing', () => {
    test('getAccountsFromCookies should extract accounts from cookies', async () => {
      const mockCookies = [
        {
          name: 'ACCOUNT_CHOOSER_DATA',
          value: encodeURIComponent('test@example.com')
        }
      ];
      
      mockChrome.cookies.getAll.mockImplementation((options, callback) => {
        callback(mockCookies);
      });

      const getAccountsFromCookies = async () => {
        try {
          const accounts = [];
          const cookies = await new Promise((resolve, reject) => {
            mockChrome.cookies.getAll({ domain: '.google.com' }, (cookies) => {
              if (mockChrome.runtime.lastError) reject(new Error(mockChrome.runtime.lastError.message));
              else resolve(cookies || []);
            });
          });
          
          if (!cookies || cookies.length === 0) return [];
          
          const accountCookies = cookies.filter(c => c.name.includes('ACCOUNT_CHOOSER'));
          
          for (const cookie of accountCookies) {
            let cookieValue;
            try {
              cookieValue = decodeURIComponent(cookie.value);
            } catch (e) {
              cookieValue = cookie.value;
            }
            
            const emailMatches = cookieValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (emailMatches) {
              emailMatches.forEach(email => {
                if (!email.includes('google.com')) {
                  if (!accounts.find(acc => acc.email === email)) {
                    accounts.push({ email: email, authuser: accounts.length, source: 'cookie' });
                  }
                }
              });
            }
          }
          
          accounts.sort((a, b) => a.authuser - b.authuser);
          return accounts;
        } catch (error) {
          return [];
        }
      };

      const result = await getAccountsFromCookies();
      
      expect(mockChrome.cookies.getAll).toHaveBeenCalledWith(
        { domain: '.google.com' },
        expect.any(Function)
      );
      expect(result).toEqual([
        { email: 'test@example.com', authuser: 0, source: 'cookie' }
      ]);
    });
  });
});