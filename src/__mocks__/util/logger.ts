const mockLogger: any = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn((): any => mockLogger),
};

export default mockLogger;
export const getLogPath = jest.fn(() => "/mock/log/path");
export const getSessionId = jest.fn(() => "mock-session-id");