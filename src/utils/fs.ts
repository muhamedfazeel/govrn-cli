import fs from 'node:fs';
import path from 'node:path';

export interface SymlinkInfo {
  isSymlink: boolean;
  target?: string;
  resolvedPath?: string;
  isBroken?: boolean;
  isAbsolute?: boolean;
  isRelativeNonPortable?: boolean;
}

/**
 * Normalizes any path to use POSIX slashes.
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Checks if a path is safely inspectable as a symlink without throwing.
 */
export function inspectSymlink(filePath: string): SymlinkInfo {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isSymbolicLink()) {
      return { isSymlink: false };
    }

    const rawTarget = fs.readlinkSync(filePath);
    const isAbsolute = path.isAbsolute(rawTarget);
    const resolvedPath = path.resolve(path.dirname(filePath), rawTarget);
    const exists = fs.existsSync(resolvedPath);

    // Non-portable relative symlink flag for Windows without Developer Mode
    const isRelativeNonPortable = !isAbsolute && (rawTarget.includes('/') || rawTarget.includes('\\'));

    return {
      isSymlink: true,
      target: toPosixPath(rawTarget),
      resolvedPath: toPosixPath(resolvedPath),
      isBroken: !exists,
      isAbsolute,
      isRelativeNonPortable,
    };
  } catch {
    return { isSymlink: false };
  }
}

/**
 * Safely reads a text file or returns empty string if unreadable.
 */
export function safeReadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Safely checks if a file or directory exists.
 */
export function safeExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}
