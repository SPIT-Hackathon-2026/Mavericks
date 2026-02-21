/**
 * ExpoFS – A POSIX-like `fs` adapter for isomorphic-git that uses
 * Expo SDK 54's native File / Directory classes instead of IndexedDB.
 *
 * isomorphic-git expects `fs.promises` with:
 *   readFile, writeFile, unlink, readdir, mkdir, rmdir, stat, lstat, rename
 *
 * All paths coming from isomorphic-git are absolute POSIX paths like
 *   /repos/my-repo/.git/HEAD
 * We prefix them with the Expo document directory to get native URIs.
 */
import { File, Directory, Paths } from 'expo-file-system';

const TAG = '[ExpoFS]';

// Expo needs file:// URIs. Paths.document already gives us the root.
const DOC_ROOT = Paths.document.uri.replace(/\/$/, ''); // e.g. file:///data/.../files

function toUri(posixPath: string): string {
  // posixPath is something like /repos/GitLane-Demo/.git/HEAD
  // We prepend the document directory URI
  return DOC_ROOT + posixPath;
}

// ── Stat result matching isomorphic-git's expectations ──────────────
class StatResult {
  type: 'file' | 'dir';
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
  dev: number;

  constructor(opts: { type: 'file' | 'dir'; size?: number; mtimeMs?: number }) {
    this.type = opts.type;
    this.mode = opts.type === 'file' ? 0o100644 : 0o40755;
    this.size = opts.size ?? 0;
    this.ino = 0;
    this.mtimeMs = opts.mtimeMs ?? Date.now();
    this.ctimeMs = this.mtimeMs;
    this.uid = 1000;
    this.gid = 1000;
    this.dev = 0;
  }

  isFile() {
    return this.type === 'file';
  }
  isDirectory() {
    return this.type === 'dir';
  }
  isSymbolicLink() {
    return false;
  }
}

// ── The promises-based fs object ────────────────────────────────────

const promises = {
  async readFile(
    filepath: string,
    opts?: { encoding?: 'utf8' } | string,
  ): Promise<Uint8Array | string> {
    const uri = toUri(filepath);
    const f = new File(uri);

    if (!f.exists) {
      throw Object.assign(new Error(`ENOENT: no such file or directory, open '${filepath}'`), { code: 'ENOENT' });
    }

    const encoding = typeof opts === 'string' ? opts : opts?.encoding;

    if (encoding === 'utf8') {
      return await f.text();
    }
    // Return Uint8Array for binary reads (default for isomorphic-git)
    return await f.bytes();
  },

  async writeFile(
    filepath: string,
    data: Uint8Array | string,
    opts?: { encoding?: 'utf8' } | string,
  ): Promise<void> {
    const uri = toUri(filepath);
    const f = new File(uri);

    // Ensure parent directory exists
    const parentDir = f.parentDirectory;
    if (!parentDir.exists) {
      parentDir.create({ intermediates: true, idempotent: true });
    }

    if (!f.exists) {
      f.create({ intermediates: true, overwrite: true });
    }

    const encoding = typeof opts === 'string' ? opts : opts?.encoding;

    if (typeof data === 'string') {
      f.write(data, { encoding: encoding === 'utf8' ? 'utf8' : undefined });
    } else {
      // Uint8Array
      f.write(data);
    }
  },

  async unlink(filepath: string): Promise<void> {
    const uri = toUri(filepath);
    const f = new File(uri);
    if (f.exists) {
      f.delete();
    }
  },

  async readdir(filepath: string): Promise<string[]> {
    const uri = toUri(filepath);
    const d = new Directory(uri);

    if (!d.exists) {
      throw Object.assign(new Error(`ENOENT: no such file or directory, scandir '${filepath}'`), { code: 'ENOENT' });
    }

    const items = d.list();
    return items.map((item) => item.name);
  },

  async mkdir(filepath: string, opts?: { recursive?: boolean }): Promise<void> {
    const uri = toUri(filepath);
    const d = new Directory(uri);
    if (!d.exists) {
      d.create({ intermediates: true, idempotent: true });
    }
  },

  async rmdir(filepath: string): Promise<void> {
    const uri = toUri(filepath);
    const d = new Directory(uri);
    if (d.exists) {
      d.delete(); // also deletes contents
    }
  },

  async stat(filepath: string): Promise<StatResult> {
    const uri = toUri(filepath);

    // Check as file first
    const f = new File(uri);
    if (f.exists) {
      return new StatResult({
        type: 'file',
        size: f.size ?? 0,
        mtimeMs: f.modificationTime ?? Date.now(),
      });
    }

    // Check as directory
    const d = new Directory(uri);
    if (d.exists) {
      return new StatResult({
        type: 'dir',
        size: 0,
        mtimeMs: Date.now(),
      });
    }

    throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${filepath}'`), { code: 'ENOENT' });
  },

  async lstat(filepath: string): Promise<StatResult> {
    // No symlink support – just delegate to stat
    return promises.stat(filepath);
  },

  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldUri = toUri(oldPath);
    const newUri = toUri(newPath);

    // Try file first
    const f = new File(oldUri);
    if (f.exists) {
      const dest = new File(newUri);
      // Ensure parent of destination exists
      const parentDir = dest.parentDirectory;
      if (!parentDir.exists) {
        parentDir.create({ intermediates: true, idempotent: true });
      }
      f.move(dest);
      return;
    }

    // Then directory
    const d = new Directory(oldUri);
    if (d.exists) {
      const dest = new Directory(newUri);
      d.move(dest);
      return;
    }

    throw Object.assign(new Error(`ENOENT: no such file or directory, rename '${oldPath}'`), { code: 'ENOENT' });
  },

  async symlink(): Promise<void> {
    throw new Error('Symlinks are not supported in ExpoFS');
  },

  async readlink(): Promise<string> {
    throw new Error('Symlinks are not supported in ExpoFS');
  },
};

/**
 * The `fs` object to pass to isomorphic-git.
 * isomorphic-git expects { promises: { ... } }
 */
export const expoFS = { promises };

/**
 * Helper: return the document directory path prefix (no trailing slash).
 * Useful for code that needs to map between native URIs and POSIX paths.
 */
export function getDocRoot(): string {
  return DOC_ROOT;
}
