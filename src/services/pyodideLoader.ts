/**
 * Pyodide runtime manager.
 *
 * Loads Pyodide (CPython -> WebAssembly) and provides a Python execution environment.
 * Used for running COBRApy (FBA), thermodynamics, and kinetics engines.
 *
 * Pyodide is loaded lazily on first use to avoid blocking app startup.
 * The initial load downloads ~15MB of WASM + Python standard library.
 */
import type { PyodideInterface } from "pyodide";

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

/**
 * Load Pyodide (singleton). Returns the same instance on subsequent calls.
 */
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { loadPyodide: loadPyodideFn } = await import("pyodide");
    const pyodide = await loadPyodideFn({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return loadPromise;
}

/**
 * Run Python code and return the result.
 * Automatically loads Pyodide if not already loaded.
 */
export async function runPython<T = unknown>(code: string): Promise<T> {
  const pyodide = await loadPyodide();
  return pyodide.runPython(code) as T;
}

/**
 * Install a Python package via micropip.
 */
export async function installPackage(packageName: string): Promise<void> {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('${packageName}')
  `);
}

/**
 * Check if a Python package is available.
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    await runPython(`
      import importlib
      importlib.import_module('${packageName}')
      True
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Pyodide version info.
 */
export async function getPyodideVersion(): Promise<string> {
  return await runPython<string>("import sys; sys.version");
}

/**
 * Reset the Pyodide instance (for testing).
 */
export function resetPyodide(): void {
  pyodideInstance = null;
  loadPromise = null;
}
