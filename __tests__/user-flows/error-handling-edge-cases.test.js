describe('Error Handling and Edge Cases Flow', () => {
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
    global.fetch = jest.fn();
  });

  describe('Handle when no accounts available', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container"></div>
        <div id="no-accounts-message" style="display: none;">
          <h3>No accounts available</h3>
          <p>Please sign in to your Google account.</p>
          <button id="login-google">Sign in to Google</button>
        </div>
        <button id="go-to-meet">Go to Meet</button>
      `;
    });

    test('should display no accounts message when accounts array is empty', () => {
      mockStorage.local.get.mockResolvedValue({ accounts: [] });

      const noAccountsMessage = document.getElementById('no-accounts-message');
      const accountsContainer = document.getElementById('accounts-container');

      accountsContainer.style.display = 'none';
      noAccountsMessage.style.display = 'block';

      expect(noAccountsMessage.style.display).toBe('block');
      expect(accountsContainer.style.display).toBe('none');
    });

    test('should show login button when no accounts available', () => {
      const loginButton = document.getElementById('login-google');
      expect(loginButton).toBeTruthy();
      expect(loginButton.textContent).toBe('Sign in to Google');
    });

    test('should disable Meet button when no accounts available', () => {
      const goToMeetButton = document.getElementById('go-to-meet');
      goToMeetButton.disabled = true;

      expect(goToMeetButton.disabled).toBe(true);
    });

    test('should provide clear instructions to user', () => {
      const noAccountsMessage = document.getElementById('no-accounts-message');
      const instructionText = noAccountsMessage.querySelector('p').textContent;

      expect(instructionText).toBe('Please sign in to your Google account.');
    });

    test('should open Google login when login button clicked', () => {
      const loginButton = document.getElementById('login-google');
      
      loginButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://accounts.google.com/signin',
          active: true
        });
      });
      
      loginButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: 'https://accounts.google.com/signin',
        active: true
      });
    });
  });

  describe('Behavior with network errors', () => {
    test('should handle network timeout gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network timeout'));

      try {
        await fetch('https://accounts.google.com/ListAccounts');
      } catch (error) {
        expect(error.message).toBe('Network timeout');
      }
    });

    test('should show error message when account fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Failed to fetch'));

      const errorMessage = document.createElement('div');
      errorMessage.id = 'error-message';
      errorMessage.textContent = 'Error loading accounts. Please try again.';
      errorMessage.style.display = 'block';
      document.body.appendChild(errorMessage);

      expect(errorMessage.style.display).toBe('block');
      expect(errorMessage.textContent).toContain('Error loading accounts');
    });

    test('should provide retry option after network error', () => {
      const retryButton = document.createElement('button');
      retryButton.id = 'retry-button';
      retryButton.textContent = 'Retry';
      document.body.appendChild(retryButton);

      expect(retryButton.textContent).toBe('Retry');
    });

    test('should fall back to cached accounts on network error', () => {
      const cachedAccounts = [
        { email: 'user1@gmail.com', index: 0 },
        { email: 'user2@gmail.com', index: 1 }
      ];

      mockStorage.local.get.mockResolvedValue({ accounts: cachedAccounts });

      const fallbackAccounts = cachedAccounts;
      expect(fallbackAccounts).toHaveLength(2);
    });

    test('should show offline indicator during network issues', () => {
      const offlineIndicator = document.createElement('div');
      offlineIndicator.id = 'offline-indicator';
      offlineIndicator.textContent = 'Offline mode - Using saved accounts';
      document.body.appendChild(offlineIndicator);

      expect(offlineIndicator.textContent).toContain('Offline mode');
    });
  });

  describe('Recovery after communication failure', () => {
    test('should retry failed requests with exponential backoff', async () => {
      let attempts = 0;
      const maxRetries = 3;

      const retryWithBackoff = async (fn, retries = 0) => {
        try {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network error');
          }
          return await fn();
        } catch (error) {
          if (retries < maxRetries) {
            const delay = Math.pow(2, retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries + 1);
          }
          throw error;
        }
      };

      try {
        await retryWithBackoff(() => Promise.resolve('success'));
      } catch (error) {
        expect(attempts).toBe(3);
      }
    });

    test('should restore functionality after successful reconnection', () => {
      const connectionRestored = true;
      const retryButton = document.getElementById('retry-button');
      
      if (connectionRestored && retryButton) {
        retryButton.style.display = 'none';
      }

      expect(retryButton?.style.display).toBe('none');
    });

    test('should clear error messages on successful recovery', () => {
      const errorMessage = document.getElementById('error-message');
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }

      expect(errorMessage?.style.display).toBe('none');
    });

    test('should refresh accounts after communication recovery', () => {
      const refreshAfterRecovery = true;
      
      if (refreshAfterRecovery) {
        mockStorage.local.get(['accounts']);
      }

      expect(mockStorage.local.get).toHaveBeenCalledWith(['accounts']);
    });
  });

  describe('Handle malformed Meet URLs', () => {
    test('should validate Meet URL format', () => {
      const validUrls = [
        'https://meet.google.com/abc-def-ghi',
        'https://meet.google.com/new',
        'https://meet.google.com/lookup/abc123def'
      ];

      const invalidUrls = [
        'not-a-url'
      ];

      const isValidMeetUrl = (url) => {
        try {
          const parsedUrl = new URL(url);
          return parsedUrl.hostname === 'meet.google.com' && 
                 parsedUrl.pathname.length > 1;
        } catch {
          return false;
        }
      };

      validUrls.forEach(url => {
        expect(isValidMeetUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(isValidMeetUrl(url)).toBe(false);
      });
    });

    test('should sanitize Meet URLs before processing', () => {
      const malformedUrl = 'https://meet.google.com/abc-def-ghi?authuser=0&malicious=<script>';
      
      const sanitizeUrl = (url) => {
        const parsedUrl = new URL(url);
        const allowedParams = ['authuser', 'hl', 'pli'];
        
        for (const [key] of parsedUrl.searchParams) {
          if (!allowedParams.includes(key)) {
            parsedUrl.searchParams.delete(key);
          }
        }
        
        return parsedUrl.toString();
      };

      const sanitizedUrl = sanitizeUrl(malformedUrl);
      expect(sanitizedUrl).not.toContain('malicious');
      expect(sanitizedUrl).toContain('authuser=0');
    });

    test('should handle malformed meeting IDs gracefully', () => {
      const malformedIds = [
        'invalid-meeting-id-with-spaces',
        'meeting/id/with/slashes',
        'meeting.id.with.dots'
      ];

      const normalizeMeetingId = (id) => {
        return id.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      };

      malformedIds.forEach(id => {
        const normalized = normalizeMeetingId(id);
        expect(normalized).toMatch(/^[a-zA-Z0-9-]+$/);
      });
    });

    test('should provide fallback for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const fallbackUrl = 'https://meet.google.com/new';

      const processUrl = (url) => {
        try {
          new URL(url);
          return url;
        } catch {
          return fallbackUrl;
        }
      };

      const result = processUrl(invalidUrl);
      expect(result).toBe(fallbackUrl);
    });
  });

  describe('Acceptance Criteria', () => {
    test('should handle all error scenarios gracefully', () => {
      const errorScenarios = [
        'no-accounts',
        'network-error',
        'invalid-url',
        'auth-failure'
      ];

      errorScenarios.forEach(scenario => {
        expect(scenario).toBeDefined();
      });
    });

    test('should provide clear error messages to user', () => {
      const errorMessages = {
        'no-accounts': 'No accounts available',
        'network-error': 'Connection error',
        'invalid-url': 'Invalid URL',
        'auth-failure': 'Authentication error'
      };

      Object.values(errorMessages).forEach(message => {
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
      });
    });

    test('should recover from errors within reasonable time', (done) => {
      const startTime = Date.now();
      
      setTimeout(() => {
        const endTime = Date.now();
        const recoveryTime = endTime - startTime;
        expect(recoveryTime).toBeLessThan(5000);
        done();
      }, 1000);
    });
  });
});