import {
  logger,
  createLogger,
  getRequestId,
  type Logger,
  type LogLevel,
  type LogEntry,
} from '../src/utils/logger';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Capture the string passed to a console method. */
function captureConsole(
  level: 'log' | 'error' | 'warn' | 'debug',
): jest.SpyInstance {
  return jest.spyOn(console, level).mockImplementation(() => {});
}

/** Parse a JSON-formatted log entry from a console spy call. */
function parseEntry(spy: jest.SpyInstance, callIndex = 0): LogEntry {
  const raw = spy.mock.calls[callIndex]?.[0] as string;
  return JSON.parse(raw) as LogEntry;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('logger (singleton)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('exports a singleton logger with debug, info, warn, error methods', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('info() emits a structured JSON entry with timestamp, level, message', () => {
    const spy = captureConsole('log');
    logger.info('test message');

    expect(spy).toHaveBeenCalledTimes(1);
    const entry = parseEntry(spy);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    expect(entry.timestamp).toBeDefined();
    // Timestamp should be a valid ISO string
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('error() uses console.error', () => {
    const spy = captureConsole('error');
    logger.error('something broke', { code: 500 });

    expect(spy).toHaveBeenCalledTimes(1);
    const entry = parseEntry(spy);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('something broke');
    expect(entry.code).toBe(500);
  });

  it('warn() uses console.warn', () => {
    const spy = captureConsole('warn');
    logger.warn('heads up', { retries: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    const entry = parseEntry(spy);
    expect(entry.level).toBe('warn');
    expect(entry.retries).toBe(3);
  });

  it('includes extra context fields in the log entry', () => {
    const spy = captureConsole('log');
    logger.info('with context', { requestId: 'abc-123', module: 'fba' });

    const entry = parseEntry(spy);
    expect(entry.requestId).toBe('abc-123');
    expect(entry.module).toBe('fba');
  });
});

describe('createLogger (scoped)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns a Logger with all four level methods', () => {
    const log = createLogger('test-module');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('attaches the context label to every log entry', () => {
    const log = createLogger('fba-engine');
    const spy = captureConsole('log');

    log.info('simplex converged', { iterations: 42 });

    const entry = parseEntry(spy);
    expect(entry.context).toBe('fba-engine');
    expect(entry.message).toBe('simplex converged');
    expect(entry.iterations).toBe(42);
  });

  it('context label appears on error entries too', () => {
    const log = createLogger('analyze-route');
    const spy = captureConsole('error');

    log.error('provider failed', { provider: 'groq' });

    const entry = parseEntry(spy);
    expect(entry.context).toBe('analyze-route');
    expect(entry.level).toBe('error');
    expect(entry.provider).toBe('groq');
  });

  it('different loggers have independent contexts', () => {
    const logA = createLogger('module-a');
    const logB = createLogger('module-b');

    const spyA = captureConsole('log');
    logA.info('from A');
    const entryA = parseEntry(spyA);
    expect(entryA.context).toBe('module-a');

    const spyB = captureConsole('warn');
    logB.warn('from B');
    const entryB = parseEntry(spyB, 0);
    expect(entryB.context).toBe('module-b');
  });
});

describe('dev vs production formatting', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('uses JSON format in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const spy = captureConsole('log');

    logger.info('prod test');

    const raw = spy.mock.calls[0]?.[0] as string;
    // Should be valid JSON
    expect(() => JSON.parse(raw)).not.toThrow();
    const entry = JSON.parse(raw) as LogEntry;
    expect(entry.message).toBe('prod test');
  });

  it('uses human-readable format in development', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const spy = captureConsole('log');

    logger.info('dev test');

    const raw = spy.mock.calls[0]?.[0] as string;
    // Dev format starts with [timestamp]
    expect(raw).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    expect(raw).toContain('INFO');
    expect(raw).toContain('dev test');
  });
});

describe('getRequestId', () => {
  it('extracts x-request-id from headers when present', () => {
    const headers = new Headers({ 'x-request-id': 'test-uuid-123' });
    expect(getRequestId(headers)).toBe('test-uuid-123');
  });

  it('generates a fallback ID when header is missing', () => {
    const headers = new Headers();
    const id = getRequestId(headers);
    expect(id).toMatch(/^local_/);
    expect(id.length).toBeGreaterThan(6);
  });
});
