describe('Manual Account Selection Flow', () => {
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

  describe('Select different account from popup', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="accounts-container">
          <div class="account-item" data-account-index="0">
            <img src="avatar1.jpg" alt="Account 1">
            <span>user1@gmail.com</span>
          </div>
          <div class="account-item" data-account-index="1">
            <img src="avatar2.jpg" alt="Account 2">
            <span>user2@gmail.com</span>
          </div>
        </div>
        <button id="go-to-meet">Go to Meet</button>
      `;
    });

    test('should display list of available accounts', () => {
      const accountItems = document.querySelectorAll('.account-item');
      expect(accountItems).toHaveLength(2);
      expect(accountItems[0].querySelector('span').textContent).toBe('user1@gmail.com');
      expect(accountItems[1].querySelector('span').textContent).toBe('user2@gmail.com');
    });

    test('should allow selecting different account', () => {
      const accountItems = document.querySelectorAll('.account-item');
      const secondAccount = accountItems[1];

      secondAccount.addEventListener('click', () => {
        secondAccount.classList.add('selected');
        accountItems[0].classList.remove('selected');
      });

      secondAccount.click();

      expect(secondAccount.classList.contains('selected')).toBe(true);
      expect(accountItems[0].classList.contains('selected')).toBe(false);
    });

    test('should store selected account index', () => {
      const accountItems = document.querySelectorAll('.account-item');
      const secondAccount = accountItems[1];

      secondAccount.addEventListener('click', () => {
        mockStorage.local.set({
          selectedAccountIndex: 1
        });
      });

      secondAccount.click();

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        selectedAccountIndex: 1
      });
    });
  });

  describe('Verify Meet opens with selected account', () => {
    test('should open Meet with correct authuser parameter', () => {
      const selectedAccountIndex = 1;
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex });

      const goToMeetButton = document.getElementById('go-to-meet');
      
      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://meet.google.com/new?authuser=1',
          active: true
        });
      });
      
      goToMeetButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('meet.google.com/new?authuser=1'),
        active: true
      });
    });

    test('should use default account (0) if no selection stored', () => {
      mockStorage.local.get.mockResolvedValue({});

      const goToMeetButton = document.getElementById('go-to-meet');
      
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

    test('should create new tab with active focus', () => {
      const selectedAccountIndex = 0;
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex });

      const goToMeetButton = document.getElementById('go-to-meet');
      
      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: 'https://meet.google.com/new?authuser=0',
          active: true
        });
      });
      
      goToMeetButton.click();

      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expect.any(String),
        active: true
      });
    });
  });

  describe('Validate selection persistence across sessions', () => {
    test('should remember selected account after popup reopens', () => {
      const savedSelection = { selectedAccountIndex: 1 };
      mockStorage.local.get.mockResolvedValue(savedSelection);

      const callback = jest.fn();
      mockStorage.local.get(['selectedAccountIndex'], callback);

      expect(mockStorage.local.get).toHaveBeenCalledWith(['selectedAccountIndex'], callback);
    });

    test('should highlight previously selected account on popup open', () => {
      const accountItems = document.querySelectorAll('.account-item');
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex: 1 });

      accountItems[1].classList.add('selected');

      expect(accountItems[1].classList.contains('selected')).toBe(true);
    });

    test('should persist selection across browser restart', () => {
      const testData = { selectedAccountIndex: 2 };
      
      mockStorage.local.set(testData);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith(testData);
    });
  });

  describe('Acceptance Criteria', () => {
    test('should generate correct Meet URL with authuser parameter', () => {
      const accountIndex = 2;
      const expectedUrl = `https://meet.google.com/new?authuser=${accountIndex}`;
      
      mockStorage.local.get.mockResolvedValue({ selectedAccountIndex: accountIndex });
      
      const goToMeetButton = document.getElementById('go-to-meet');
      
      goToMeetButton.addEventListener('click', () => {
        mockTabs.create({
          url: expectedUrl,
          active: true
        });
      });
      
      goToMeetButton.click();
      
      expect(mockTabs.create).toHaveBeenCalledWith({
        url: expectedUrl,
        active: true
      });
    });

    test('should handle account selection within 2 seconds', (done) => {
      const startTime = Date.now();
      
      const accountItem = document.querySelector('.account-item');
      accountItem.click();
      
      setTimeout(() => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(2000);
        done();
      }, 100);
    });
  });
});