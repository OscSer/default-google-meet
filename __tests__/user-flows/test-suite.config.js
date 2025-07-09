// Test configuration file - contains no actual tests
const userFlowsConfig = {
  testSuite: {
    name: 'Google Meet Account Selector - User Flows',
    description: 'Comprehensive test suite for critical user flows',
    version: '1.0.0'
  },
  
  testCategories: {
    primary: [
      'Manual Account Selection',
      'Account Detection and Synchronization',
      'Error Handling and Edge Cases'
    ],
    secondary: [
      'Default Account Configuration',
      'Account Updates and Refresh',
      'User Experience Flows'
    ]
  },

  performance: {
    maxResponseTime: 2000,
    maxRenderTime: 1000,
    maxNetworkTimeout: 5000
  },

  coverage: {
    minimum: 80,
    target: 90,
    critical: 95
  },

  testEnvironment: {
    browser: 'chrome',
    environment: 'jsdom',
    timeout: 10000
  },

  mocks: {
    chrome: {
      tabs: ['create', 'query', 'update', 'get'],
      storage: ['local.get', 'local.set'],
      runtime: ['getManifest', 'lastError'],
      alarms: ['create', 'get', 'clear']
    },
    external: {
      fetch: true,
      localStorage: true,
      sessionStorage: true
    }
  },

  testData: {
    accounts: [
      {
        email: 'user1@gmail.com',
        name: 'User One',
        avatar: 'https://example.com/avatar1.jpg',
        index: 0
      },
      {
        email: 'user2@company.com',
        name: 'User Two',
        avatar: 'https://example.com/avatar2.jpg',
        index: 1
      },
      {
        email: 'user3@domain.org',
        name: 'User Three',
        avatar: 'https://example.com/avatar3.jpg',
        index: 2
      }
    ],
    meetUrls: {
      valid: [
        'https://meet.google.com/abc-def-ghi',
        'https://meet.google.com/new',
        'https://meet.google.com/lookup/xyz123'
      ],
      invalid: [
        'https://meet.google.com/',
        'invalid-url',
        'https://meet.google.com/invalid url with spaces'
      ]
    }
  },

  scenarios: {
    'manual-selection': {
      name: 'Select different account from popup',
      priority: 'high',
      preconditions: 'User logged in multiple Google accounts',
      steps: [
        'Open extension popup',
        'View account list',
        'Select different account',
        'Click "Ir a Meet"'
      ],
      expected: 'New tab opens with Meet using selected account'
    },
    'account-verification': {
      name: 'Verify Meet opens with selected account',
      priority: 'high',
      preconditions: 'Account selected in manual selection',
      steps: [
        'Observe Meet tab that opened',
        'Check account indicator in Meet UI',
        'Attempt to join test meeting'
      ],
      expected: 'Meet shows correct account and allows joining'
    },
    'account-detection': {
      name: 'Detect incorrect account in active Meet',
      priority: 'high',
      preconditions: 'User in Meet with account A, wants account B',
      steps: [
        'Be in active Meet session',
        'Open extension popup',
        'Select different account',
        'Click "Ir a Meet"'
      ],
      expected: 'Automatic redirect to Meet with correct account'
    },
    'no-accounts-handling': {
      name: 'Handle no accounts available',
      priority: 'high',
      preconditions: 'User not logged in any Google account',
      steps: [
        'Open extension popup',
        'Observe UI state'
      ],
      expected: 'Clear message with instructions to add accounts'
    },
    'loading-feedback': {
      name: 'Loading states and visual feedback',
      priority: 'medium',
      preconditions: 'Extension installed',
      steps: [
        'Open popup while accounts loading',
        'Observe loading indicators',
        'Click "Refresh Accounts"',
        'Observe state transitions'
      ],
      expected: 'Clear loading indicators during async operations'
    }
  },

  acceptance: {
    global: [
      'All primary flows work without errors',
      'Response times < 2 seconds for normal operations',
      'Graceful handling of all error cases',
      'Responsive UI with appropriate visual feedback',
      'Correct persistence of user configurations',
      'Chrome compatibility across versions',
      'Correct behavior with multiple Meet tabs'
    ],
    specific: {
      'manual-selection': 'URL contains correct authuser parameter',
      'account-verification': 'Avatar/name in Meet matches selected account',
      'account-detection': 'Meet session updates without losing meeting context',
      'no-accounts-handling': 'UI shows explanatory message with add account instructions',
      'loading-feedback': 'User never sees frozen UI or missing feedback'
    }
  }
};

module.exports = userFlowsConfig;