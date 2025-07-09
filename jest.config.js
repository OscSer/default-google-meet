const config = {
  setupFiles: ["./__mocks__/chrome.ts"],
  testEnvironment: "jsdom",
  transform: {
    "^.+.ts$": ["ts-jest", {}],
  },
  collectCoverageFrom: [
    "**/*.{js,ts}",
    "!**/node_modules/**",
    "!**/dist/**"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "__tests__/user-flows/test-suite.config.js"
  ]
}
module.exports = config;