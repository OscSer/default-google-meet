global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: undefined,
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};