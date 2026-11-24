import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { toPosixPath, inspectSymlink, safeReadFile, safeExists } from '../src/utils/fs.js';
import { logger } from '../src/utils/logger.js';

describe('fs utils', () => {
  it('converts backslashes to posix slashes', () => {
    expect(toPosixPath('foo\\bar\\baz')).toBe('foo/bar/baz');
    expect(toPosixPath('foo/bar/baz')).toBe('foo/bar/baz');
  });

  it('safely checks existence', () => {
    expect(safeExists(process.cwd())).toBe(true);
    expect(safeExists('/non-existent-path-12345')).toBe(false);
  });

  it('safely reads files', () => {
    const tmpFile = path.join(os.tmpdir(), `govrn-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'hello govrn', 'utf8');

    expect(safeReadFile(tmpFile)).toBe('hello govrn');
    expect(safeReadFile('/non-existent-path-12345')).toBe('');

    fs.unlinkSync(tmpFile);
  });

  it('inspects symlinks correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'govrn-symlink-'));
    const targetFile = path.join(tmpDir, 'target.txt');
    const symlinkPath = path.join(tmpDir, 'link.txt');
    const nonExistentTarget = path.join(tmpDir, 'missing.txt');
    const brokenSymlinkPath = path.join(tmpDir, 'broken-link.txt');

    fs.writeFileSync(targetFile, 'target content', 'utf8');

    try {
      fs.symlinkSync(targetFile, symlinkPath);
      const info = inspectSymlink(symlinkPath);
      expect(info.isSymlink).toBe(true);
      expect(info.isBroken).toBe(false);
      expect(info.isAbsolute).toBe(true);

      fs.symlinkSync(nonExistentTarget, brokenSymlinkPath);
      const brokenInfo = inspectSymlink(brokenSymlinkPath);
      expect(brokenInfo.isSymlink).toBe(true);
      expect(brokenInfo.isBroken).toBe(true);

      const nonSymlinkInfo = inspectSymlink(targetFile);
      expect(nonSymlinkInfo.isSymlink).toBe(false);

      const invalidInfo = inspectSymlink(path.join(tmpDir, 'does-not-exist'));
      expect(invalidInfo.isSymlink).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('logger', () => {
  it('provides logging methods without throwing', () => {
    expect(() => {
      logger.info('test info');
      logger.success('test success');
      logger.warn('test warn');
      logger.error('test error');
      logger.dim('test dim');
    }).not.toThrow();
  });
});
