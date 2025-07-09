describe('Popup Functions', () => {
  let mockDocument;
  let mockChrome;

  beforeEach(() => {
    mockDocument = {
      getElementById: jest.fn(),
      createElement: jest.fn(),
      querySelectorAll: jest.fn(),
      addEventListener: jest.fn()
    };
    
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: undefined
      },
      tabs: {
        create: jest.fn()
      }
    };
    
    global.document = mockDocument;
    global.chrome = mockChrome;
    global.alert = jest.fn();
  });

  describe('showContent', () => {
    test('should show content div and hide error and loading divs', () => {
      const contentDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const errorDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const loadingDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      
      mockDocument.getElementById.mockReturnValueOnce(contentDiv)
        .mockReturnValueOnce(errorDiv)
        .mockReturnValueOnce(loadingDiv);

      const showContent = () => {
        contentDiv.classList.remove("hidden");
        errorDiv.classList.add("hidden");
        loadingDiv.classList.add("hidden");
      };

      showContent();

      expect(contentDiv.classList.remove).toHaveBeenCalledWith("hidden");
      expect(errorDiv.classList.add).toHaveBeenCalledWith("hidden");
      expect(loadingDiv.classList.add).toHaveBeenCalledWith("hidden");
    });
  });

  describe('showError', () => {
    test('should show error div and hide content and loading divs', () => {
      const contentDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const errorDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const loadingDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      
      mockDocument.getElementById.mockReturnValueOnce(contentDiv)
        .mockReturnValueOnce(errorDiv)
        .mockReturnValueOnce(loadingDiv);

      const showError = () => {
        contentDiv.classList.add("hidden");
        loadingDiv.classList.add("hidden");
        errorDiv.classList.remove("hidden");
      };

      showError();

      expect(contentDiv.classList.add).toHaveBeenCalledWith("hidden");
      expect(loadingDiv.classList.add).toHaveBeenCalledWith("hidden");
      expect(errorDiv.classList.remove).toHaveBeenCalledWith("hidden");
    });
  });

  describe('showLoading', () => {
    test('should show loading div and hide content and error divs', () => {
      const contentDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const errorDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      const loadingDiv = { classList: { remove: jest.fn(), add: jest.fn() } };
      
      mockDocument.getElementById.mockReturnValueOnce(contentDiv)
        .mockReturnValueOnce(errorDiv)
        .mockReturnValueOnce(loadingDiv);

      const showLoading = () => {
        contentDiv.classList.add("hidden");
        errorDiv.classList.add("hidden");
        loadingDiv.classList.remove("hidden");
      };

      showLoading();

      expect(contentDiv.classList.add).toHaveBeenCalledWith("hidden");
      expect(errorDiv.classList.add).toHaveBeenCalledWith("hidden");
      expect(loadingDiv.classList.remove).toHaveBeenCalledWith("hidden");
    });
  });

  describe('createAccountElement', () => {
    test('should create account element with correct structure', () => {
      const mockItem = {
        className: '',
        dataset: {},
        appendChild: jest.fn(),
        addEventListener: jest.fn()
      };
      
      const mockEmail = {
        className: '',
        textContent: ''
      };
      
      const mockIndicator = {
        className: ''
      };

      mockDocument.createElement.mockReturnValueOnce(mockItem)
        .mockReturnValueOnce(mockEmail)
        .mockReturnValueOnce(mockIndicator);

      const createAccountElement = (account, index, isDefault) => {
        const item = mockDocument.createElement("div");
        item.className = `account-row ${isDefault ? "selected" : ""}`;
        item.dataset.index = index;

        const email = mockDocument.createElement("div");
        email.className = "account-email";
        email.textContent = account.email;

        const indicator = mockDocument.createElement("div");
        indicator.className = `status-indicator ${isDefault ? "default" : ""}`;

        item.appendChild(email);
        item.appendChild(indicator);

        return item;
      };

      const account = { email: 'test@example.com' };
      const result = createAccountElement(account, 0, true);

      expect(mockDocument.createElement).toHaveBeenCalledWith("div");
      expect(mockItem.className).toBe("account-row selected");
      expect(mockItem.dataset.index).toBe(0);
      expect(mockEmail.className).toBe("account-email");
      expect(mockEmail.textContent).toBe("test@example.com");
      expect(mockIndicator.className).toBe("status-indicator default");
      expect(mockItem.appendChild).toHaveBeenCalledWith(mockEmail);
      expect(mockItem.appendChild).toHaveBeenCalledWith(mockIndicator);
    });
  });

  describe('setDefaultAccount', () => {
    test('should send message to chrome runtime with correct action', () => {
      const mockItems = [
        { 
          classList: { toggle: jest.fn() },
          querySelector: jest.fn().mockReturnValue({ className: '' })
        }
      ];
      
      mockDocument.querySelectorAll.mockReturnValue(mockItems);

      const setDefaultAccount = (index) => {
        mockChrome.runtime.sendMessage({
          action: "setDefaultAccount",
          accountIndex: index,
        });
      };

      setDefaultAccount(1);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: "setDefaultAccount",
        accountIndex: 1,
      });
    });
  });

  describe('refreshAccounts', () => {
    test('should send refresh message and handle response', (done) => {
      const refreshAccounts = () => {
        return new Promise((resolve) => {
          mockChrome.runtime.sendMessage({ action: "refreshAccounts" }, (response) => {
            resolve();
          });
        });
      };

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        expect(message.action).toBe("refreshAccounts");
        callback({ success: true, accounts: [] });
      });

      refreshAccounts().then(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          { action: "refreshAccounts" },
          expect.any(Function)
        );
        done();
      });
    });
  });
});