# User Flows Test Suite

Comprehensive test suite for critical user flows of the Google Meet Account Selector extension.

## Test Structure

### Primary Flows (High Priority)
- **Manual Account Selection**: Tests account selection from popup
- **Detection and Synchronization**: Tests account detection and automatic redirection
- **Error Handling and Edge Cases**: Tests error scenarios and edge cases

### Secondary Flows (Medium Priority)
- **Default Account Configuration**: Tests setting and using default accounts
- **Account Updates**: Tests account refresh and updates
- **User Experience**: Tests UI/UX flows and interactions

## Test Files

| File | Coverage | Description |
|------|----------|-------------|
| `manual-account-selection.test.js` | Manual account selection flow | Tests popup account selection, Meet URL generation, and persistence |
| `default-account-configuration.test.js` | Default account configuration | Tests setting, using, and changing default accounts |
| `account-detection-sync.test.js` | Account detection and sync | Tests wrong account detection and automatic redirection |
| `account-updates-refresh.test.js` | Account updates | Tests manual refresh, automatic updates, and new account detection |
| `error-handling-edge-cases.test.js` | Error handling | Tests no accounts, network errors, recovery, and malformed URLs |
| `user-experience-flows.test.js` | User experience | Tests loading states, multiple accounts, missing data, and keyboard navigation |

## Running Tests

```bash
# Run all user flow tests
npm test __tests__/user-flows/

# Run specific test file
npm test __tests__/user-flows/manual-account-selection.test.js

# Run with coverage
npm run test:coverage -- __tests__/user-flows/

# Watch mode for development
npm run test:watch -- __tests__/user-flows/
```

## Test Configuration

See `test-suite.config.js` for:
- Performance requirements (< 2s response time)
- Coverage thresholds (80% minimum, 90% target)
- Mock configurations for Chrome APIs
- Test data for accounts and URLs
- Acceptance criteria for each scenario

## Key Test Scenarios

### Manual Account Selection
Validates that users can select different Google accounts from the popup and that Meet opens with the correct account.

### Account Detection and Sync
Tests the extension's ability to detect when a user is in Meet with the wrong account and automatically redirect.

### Error Handling and Edge Cases
Ensures graceful handling when no Google accounts are available, with clear user guidance.

### User Experience Flows
Validates loading states, visual feedback, and responsive behavior with multiple accounts.

## Acceptance Criteria

### Global Requirements
- All primary flows work without errors
- Response times < 2 seconds for normal operations
- Graceful handling of all error cases
- Responsive UI with appropriate visual feedback
- Correct persistence of user configurations
- Chrome compatibility across versions
- Correct behavior with multiple Meet tabs

### Specific Requirements
- **Manual Selection**: URL contains correct `authuser` parameter
- **Account Verification**: Avatar/name in Meet matches selected account
- **Account Detection**: Meet session updates without losing meeting context
- **No Accounts Handling**: UI shows explanatory message with add account instructions
- **Loading Feedback**: User never sees frozen UI or missing feedback

## Performance Targets

- **Response Time**: < 2 seconds for normal operations
- **Render Time**: < 1 second for UI updates
- **Network Timeout**: < 5 seconds for account fetching
- **Test Coverage**: 80% minimum, 90% target, 95% for critical paths

## Mock Strategy

The tests use comprehensive mocks for:
- Chrome extension APIs (`chrome.tabs`, `chrome.storage`, `chrome.runtime`)
- External APIs (`fetch`, `localStorage`)
- DOM manipulation and event handling
- Network requests and responses

This ensures tests are fast, reliable, and don't depend on external services.