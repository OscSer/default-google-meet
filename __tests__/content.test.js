describe('Content Script', () => {
  let mockChrome;
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: undefined,
        onMessage: {
          addListener: jest.fn()
        }
      }
    };

    mockWindow = {
      location: {
        href: 'https://meet.google.com/test',
        search: '?authuser=0'
      }
    };

    mockDocument = {
      querySelectorAll: jest.fn(),
      documentElement: {
        outerHTML: '<html><body>test content</body></html>'
      },
      title: 'Google Meet Test',
      readyState: 'complete',
      addEventListener: jest.fn(),
      body: {}
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.document = mockDocument;
    global.URLSearchParams = jest.fn();
    global.MutationObserver = jest.fn();
    global.setTimeout = jest.fn();
  });

  describe('getCurrentAccount', () => {
    test('should return authuser from URL parameters', () => {
      const mockURLSearchParams = {
        get: jest.fn().mockReturnValue('2')
      };
      global.URLSearchParams.mockReturnValue(mockURLSearchParams);

      const getCurrentAccount = () => {
        const urlParams = new URLSearchParams(mockWindow.location.search);
        const authuser = urlParams.get('authuser');
        
        if (authuser !== null) {
          return parseInt(authuser);
        }
        
        return null;
      };

      const result = getCurrentAccount();
      
      expect(global.URLSearchParams).toHaveBeenCalledWith(mockWindow.location.search);
      expect(mockURLSearchParams.get).toHaveBeenCalledWith('authuser');
      expect(result).toBe(2);
    });

    test('should return null when no authuser in URL', () => {
      const mockURLSearchParams = {
        get: jest.fn().mockReturnValue(null)
      };
      global.URLSearchParams.mockReturnValue(mockURLSearchParams);

      const getCurrentAccount = () => {
        const urlParams = new URLSearchParams(mockWindow.location.search);
        const authuser = urlParams.get('authuser');
        
        if (authuser !== null) {
          return parseInt(authuser);
        }
        
        return null;
      };

      const result = getCurrentAccount();
      
      expect(result).toBe(null);
    });
  });

  describe('getCurrentEmail', () => {
    test('should extract email from element data-email attribute', () => {
      const mockElement = {
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === 'data-email') return 'test@example.com';
          return null;
        })
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);

      const getCurrentEmail = () => {
        try {
          const userSelectors = ['[data-email]'];
          
          for (const selector of userSelectors) {
            const elements = mockDocument.querySelectorAll(selector);
            for (const element of elements) {
              const dataEmail = element.getAttribute('data-email');
              if (dataEmail && dataEmail.includes('@')) {
                return dataEmail;
              }
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      };

      const result = getCurrentEmail();
      
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('[data-email]');
      expect(mockElement.getAttribute).toHaveBeenCalledWith('data-email');
      expect(result).toBe('test@example.com');
    });

    test('should extract email from aria-label attribute', () => {
      const mockElement = {
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === 'data-email') return null;
          if (attr === 'aria-label') return 'User test@example.com';
          return null;
        })
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);

      const getCurrentEmail = () => {
        try {
          const userSelectors = ['[data-email]'];
          
          for (const selector of userSelectors) {
            const elements = mockDocument.querySelectorAll(selector);
            for (const element of elements) {
              const dataEmail = element.getAttribute('data-email');
              if (dataEmail && dataEmail.includes('@')) {
                return dataEmail;
              }
              
              const ariaLabel = element.getAttribute('aria-label');
              if (ariaLabel) {
                const emailMatch = ariaLabel.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                  return emailMatch[0];
                }
              }
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      };

      const result = getCurrentEmail();
      
      expect(mockElement.getAttribute).toHaveBeenCalledWith('aria-label');
      expect(result).toBe('test@example.com');
    });

    test('should return null when no email found', () => {
      const mockElement = {
        getAttribute: jest.fn().mockReturnValue(null),
        textContent: ''
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);

      const getCurrentEmail = () => {
        try {
          const userSelectors = ['[data-email]'];
          
          for (const selector of userSelectors) {
            const elements = mockDocument.querySelectorAll(selector);
            for (const element of elements) {
              const dataEmail = element.getAttribute('data-email');
              if (dataEmail && dataEmail.includes('@')) {
                return dataEmail;
              }
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      };

      const result = getCurrentEmail();
      
      expect(result).toBe(null);
    });
  });

  describe('checkAccountSync', () => {
    test('should send checkAccountMismatch message when on Meet', () => {
      mockWindow.location.href = 'https://meet.google.com/test';
      
      const checkAccountSync = () => {
        const currentUrl = mockWindow.location.href;
        
        if (!currentUrl.includes('meet.google.com')) {
          return;
        }
        
        mockChrome.runtime.sendMessage({
          action: 'checkAccountMismatch',
          url: currentUrl
        }, (response) => {
          if (mockChrome.runtime.lastError) {
            return;
          }
          
          if (response && response.needsRedirect) {
            mockWindow.location.href = response.redirectUrl;
          }
        });
      };

      checkAccountSync();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'checkAccountMismatch',
          url: 'https://meet.google.com/test'
        },
        expect.any(Function)
      );
    });

    test('should not send message when not on Meet', () => {
      mockWindow.location.href = 'https://google.com';
      
      const checkAccountSync = () => {
        const currentUrl = mockWindow.location.href;
        
        if (!currentUrl.includes('meet.google.com')) {
          return;
        }
        
        mockChrome.runtime.sendMessage({
          action: 'checkAccountMismatch',
          url: currentUrl
        });
      };

      checkAccountSync();
      
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should redirect when response indicates need for redirect', () => {
      mockWindow.location.href = 'https://meet.google.com/test';
      const redirectUrl = 'https://meet.google.com/test?authuser=1';
      
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          needsRedirect: true,
          redirectUrl: redirectUrl
        });
      });

      const checkAccountSync = () => {
        const currentUrl = mockWindow.location.href;
        
        if (!currentUrl.includes('meet.google.com')) {
          return;
        }
        
        mockChrome.runtime.sendMessage({
          action: 'checkAccountMismatch',
          url: currentUrl
        }, (response) => {
          if (mockChrome.runtime.lastError) {
            return;
          }
          
          if (response && response.needsRedirect) {
            mockWindow.location.href = response.redirectUrl;
          }
        });
      };

      checkAccountSync();
      
      expect(mockWindow.location.href).toBe(redirectUrl);
    });
  });

  describe('Message Handling', () => {
    test('should handle getPageInfo message', () => {
      const mockSendResponse = jest.fn();
      
      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'getPageInfo') {
          sendResponse({
            url: mockWindow.location.href,
            title: mockDocument.title,
            currentAccount: null
          });
        }
      };

      messageHandler(
        { action: 'getPageInfo' },
        {},
        mockSendResponse
      );
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        url: 'https://meet.google.com/test',
        title: 'Google Meet Test',
        currentAccount: null
      });
    });

    test('should handle detectCurrentAccount message', () => {
      const mockSendResponse = jest.fn();
      
      const messageHandler = (request, sender, sendResponse) => {
        if (request.action === 'detectCurrentAccount') {
          sendResponse({
            currentAccount: null
          });
        }
      };

      messageHandler(
        { action: 'detectCurrentAccount' },
        {},
        mockSendResponse
      );
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        currentAccount: null
      });
    });
  });

  describe('Initialization', () => {
    test('should set up MutationObserver for URL changes', () => {
      const mockObserver = {
        observe: jest.fn()
      };
      
      global.MutationObserver.mockReturnValue(mockObserver);

      const initialize = () => {
        const urlObserver = new MutationObserver(() => {});
        
        urlObserver.observe(mockDocument.body, {
          childList: true,
          subtree: true
        });
      };

      initialize();
      
      expect(global.MutationObserver).toHaveBeenCalled();
      expect(mockObserver.observe).toHaveBeenCalledWith(mockDocument.body, {
        childList: true,
        subtree: true
      });
    });

    test('should call checkAccountSync with delay on initialization', () => {
      global.setTimeout.mockImplementation((callback) => {
        callback();
      });

      const checkAccountSync = jest.fn();
      
      const initialize = () => {
        setTimeout(() => {
          checkAccountSync();
        }, 500);
      };

      initialize();
      
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
    });
  });
});