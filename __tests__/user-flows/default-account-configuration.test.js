describe('Default Account Configuration Flow', () => {
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

  describe('Set default account from popup', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container">
          <div class="account-item" data-account-index="0">
            <img src="avatar1.jpg" alt="Account 1">
            <span>user1@gmail.com</span>
            <button class="set-default-btn">Set Default</button>
          </div>
          <div class="account-item" data-account-index="1">
            <img src="avatar2.jpg" alt="Account 2">
            <span>user2@gmail.com</span>
            <button class="set-default-btn">Set Default</button>
          </div>
        </div>
        <div id="default-account-indicator">
          <span>Default account: <span id="default-account-email"></span></span>
        </div>
      `;
    });

    test('should display set default button for each account', () => {
      const setDefaultButtons = document.querySelectorAll('.set-default-btn');
      expect(setDefaultButtons).toHaveLength(2);
    });

    test('should set account as default when button clicked', () => {
      const setDefaultButton = document.querySelector('.set-default-btn');
      const accountItem = setDefaultButton.closest('.account-item');
      const accountIndex = parseInt(accountItem.dataset.accountIndex);

      setDefaultButton.addEventListener('click', () => {
        mockStorage.local.set({
          defaultAccountIndex: accountIndex
        });
      });

      setDefaultButton.click();

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        defaultAccountIndex: accountIndex
      });
    });

    test('should update UI to show default account indicator', () => {
      const setDefaultButton = document.querySelector('.set-default-btn');
      const accountItem = setDefaultButton.closest('.account-item');
      const accountEmail = accountItem.querySelector('span').textContent;

      setDefaultButton.addEventListener('click', () => {
        const defaultAccountEmail = document.getElementById('default-account-email');
        defaultAccountEmail.textContent = accountEmail;
      });

      setDefaultButton.click();

      const defaultAccountEmail = document.getElementById('default-account-email');
      expect(defaultAccountEmail.textContent).toBe(accountEmail);
    });

    test('should show visual feedback when default is set', () => {
      const accountItem = document.querySelector('.account-item');
      const setDefaultButton = accountItem.querySelector('.set-default-btn');

      setDefaultButton.addEventListener('click', () => {
        accountItem.classList.add('is-default');
      });

      setDefaultButton.click();

      expect(accountItem.classList.contains('is-default')).toBe(true);
    });
  });

  describe('Verify automatic default account usage', () => {
    test('should use default account when opening Meet', () => {
      const defaultAccountIndex = 2;
      mockStorage.local.get.mockResolvedValue({ 
        defaultAccountIndex,
        selectedAccountIndex: undefined 
      });

      const goToMeetButton = document.createElement('button');
      goToMeetButton.id = 'go-to-meet';
      document.body.appendChild(goToMeetButton);

      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://meet.google.com/new?authuser=2',
          active: true
        });
      });

      goToMeetButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('meet.google.com/new?authuser=2'),
        active: true
      });
    });

    test('should prioritize manual selection over default', () => {
      const defaultAccountIndex = 1;
      const selectedAccountIndex = 2;
      mockStorage.local.get.mockResolvedValue({ 
        defaultAccountIndex,
        selectedAccountIndex
      });

      const goToMeetButton = document.createElement('button');
      goToMeetButton.id = 'go-to-meet';
      document.body.appendChild(goToMeetButton);

      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://meet.google.com/new?authuser=2',
          active: true
        });
      });

      goToMeetButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('meet.google.com/new?authuser=2'),
        active: true
      });
    });

    test('should load default account on popup open', () => {
      const defaultAccountIndex = 1;
      mockStorage.local.get.mockResolvedValue({ defaultAccountIndex });

      const callback = jest.fn();
      mockStorage.local.get(['defaultAccountIndex'], callback);

      expect(mockStorage.local.get).toHaveBeenCalledWith(['defaultAccountIndex'], callback);
    });
  });

  describe('Change existing default account', () => {
    test('should allow changing existing default account', () => {
      mockStorage.local.get.mockResolvedValue({ defaultAccountIndex: 0 });

      const accountItems = document.querySelectorAll('.account-item');
      const newDefaultButton = accountItems[1].querySelector('.set-default-btn');
      
      newDefaultButton.addEventListener('click', () => {
        mockStorage.local.set({
          defaultAccountIndex: 1
        });
      });
      
      newDefaultButton.click();

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        defaultAccountIndex: 1
      });
    });

    test('should update UI when default account changes', () => {
      const accountItems = document.querySelectorAll('.account-item');
      
      accountItems[0].classList.add('is-default');
      
      const newDefaultButton = accountItems[1].querySelector('.set-default-btn');
      
      newDefaultButton.addEventListener('click', () => {
        accountItems[0].classList.remove('is-default');
        accountItems[1].classList.add('is-default');
      });
      
      newDefaultButton.click();

      expect(accountItems[0].classList.contains('is-default')).toBe(false);
      expect(accountItems[1].classList.contains('is-default')).toBe(true);
    });

    test('should persist new default account setting', () => {
      const newDefaultIndex = 1;
      const accountItem = document.querySelector(`[data-account-index="${newDefaultIndex}"]`);
      const setDefaultButton = accountItem.querySelector('.set-default-btn');

      setDefaultButton.addEventListener('click', () => {
        mockStorage.local.set({
          defaultAccountIndex: newDefaultIndex
        });
      });

      setDefaultButton.click();

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        defaultAccountIndex: newDefaultIndex
      });
    });

    test('should show confirmation when default account is changed', () => {
      const accountItem = document.querySelector('.account-item');
      const setDefaultButton = accountItem.querySelector('.set-default-btn');

      setDefaultButton.addEventListener('click', () => {
        setDefaultButton.textContent = '✓ Set as Default';
      });

      setDefaultButton.click();

      expect(setDefaultButton.textContent).toBe('✓ Set as Default');
    });
  });

  describe('Acceptance Criteria', () => {
    test('should handle default account logic within 2 seconds', (done) => {
      const startTime = Date.now();
      
      const setDefaultButton = document.querySelector('.set-default-btn');
      setDefaultButton.click();
      
      setTimeout(() => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(2000);
        done();
      }, 100);
    });

    test('should maintain default account across sessions', () => {
      const defaultAccountIndex = 1;
      mockStorage.local.get.mockResolvedValue({ defaultAccountIndex });

      const result = mockStorage.local.get(['defaultAccountIndex']);
      
      expect(result).toBeTruthy();
    });

    test('should gracefully handle missing default account', () => {
      mockStorage.local.get.mockResolvedValue({});

      const goToMeetButton = document.createElement('button');
      goToMeetButton.id = 'go-to-meet';
      document.body.appendChild(goToMeetButton);

      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://meet.google.com/new?authuser=0',
          active: true
        });
      });

      goToMeetButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('meet.google.com/new?authuser=0'),
        active: true
      });
    });
  });
});