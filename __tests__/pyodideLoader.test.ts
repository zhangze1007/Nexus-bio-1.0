// Mock the pyodide module since it requires a browser environment with WebAssembly
const mockRunPython = jest.fn();
const mockLoadPackage = jest.fn().mockResolvedValue(undefined);
const mockRunPythonAsync = jest.fn().mockResolvedValue(undefined);

const mockPyodideInstance = {
  runPython: mockRunPython,
  loadPackage: mockLoadPackage,
  runPythonAsync: mockRunPythonAsync,
};

jest.mock('pyodide', () => ({
  loadPyodide: jest.fn().mockResolvedValue(mockPyodideInstance),
}));

import { loadPyodide, runPython, getPyodideVersion, resetPyodide, installPackage, isPackageInstalled } from '../src/services/pyodideLoader';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  resetPyodide();
});

describe('pyodideLoader', () => {
  test('loadPyodide returns a valid instance', async () => {
    const pyodide = await loadPyodide();
    expect(pyodide).toBeDefined();
    expect(pyodide.runPython).toBeDefined();
    expect(pyodide.loadPackage).toBeDefined();
    expect(pyodide.runPythonAsync).toBeDefined();
  });

  test('loadPyodide returns the same instance on subsequent calls', async () => {
    const pyodide1 = await loadPyodide();
    const pyodide2 = await loadPyodide();
    expect(pyodide1).toBe(pyodide2);
    // loadPyodide should only be called once
    const { loadPyodide: loadPyodideFn } = require('pyodide');
    expect(loadPyodideFn).toHaveBeenCalledTimes(1);
  });

  test('runPython executes code and returns result', async () => {
    mockRunPython.mockReturnValue(5);
    const result = await runPython<number>('2 + 3');
    expect(result).toBe(5);
    expect(mockRunPython).toHaveBeenCalledWith('2 + 3');
  });

  test('runPython can handle string results', async () => {
    mockRunPython.mockReturnValue('{"a": 1}');
    const result = await runPython<string>('import json; json.dumps({"a": 1})');
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  test('getPyodideVersion returns Python version string', async () => {
    mockRunPython.mockReturnValue('Python 3.11.3');
    const version = await getPyodideVersion();
    expect(version).toContain('Python');
    expect(mockRunPython).toHaveBeenCalledWith('import sys; sys.version');
  });

  test('installPackage loads micropip and installs package', async () => {
    await installPackage('cobra');
    expect(mockLoadPackage).toHaveBeenCalledWith('micropip');
    expect(mockRunPythonAsync).toHaveBeenCalled();
    const pythonCode = mockRunPythonAsync.mock.calls[0][0];
    expect(pythonCode).toContain('micropip');
    expect(pythonCode).toContain('cobra');
  });

  test('isPackageInstalled returns true when package exists', async () => {
    mockRunPython.mockReturnValue(true);
    const result = await isPackageInstalled('json');
    expect(result).toBe(true);
  });

  test('isPackageInstalled returns false when package does not exist', async () => {
    mockRunPython.mockImplementation(() => {
      throw new Error('ModuleNotFoundError');
    });
    const result = await isPackageInstalled('nonexistent_package');
    expect(result).toBe(false);
  });

  test('resetPyodide clears the instance', async () => {
    // First load
    await loadPyodide();
    const { loadPyodide: loadPyodideFn } = require('pyodide');
    expect(loadPyodideFn).toHaveBeenCalledTimes(1);

    // Reset
    resetPyodide();

    // Second load should call loadPyodide again
    await loadPyodide();
    expect(loadPyodideFn).toHaveBeenCalledTimes(2);
  });
});
