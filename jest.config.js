const config = {
  setupFiles: ["./__mocks__/chrome.js"],
  testEnvironment: "jsdom",
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/dist/**"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "__tests__/user-flows/test-suite.config.js"
  ]
}
module.exports = config;