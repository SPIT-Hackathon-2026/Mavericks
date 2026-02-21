import git from 'isomorphic-git';
import LightningFS from '@isomorphic-git/lightning-fs';
import * as FileSystem from 'expo-file-system';
import type { Repository, GitFile, GitCommit, GitBranch, FileStatus, ChangeType } from '@/types/git';

const fs = new LightningFS('gitlane', { wipe: false }).promises;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ROOT = FileSystem.documentDirectory ?? '/';
const BASE_DIR = joinPath(ROOT, 'repos');
const DEMO_REPO = 'gitlane-demo';

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/');
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return 'just now';
  const diffMs = Date.now() - timestamp * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function ensureStatus(head: number, workdir: number, stage: number): FileStatus {
  if (head === 0 && workdir === 2 && stage === 0) return 'untracked';
  if (workdir === 2 && stage === 2) return 'staged';
  if (workdir === 2 && stage !== 2) return 'modified';
  if (head === 1 && workdir === 0 && stage === 0) return 'untracked';
  return 'modified';
}

function changeTypeFromStatus(head: number, workdir: number, stage: number): ChangeType | undefined {
  if (head === 0 && workdir === 2) return 'A';
  if (head === 1 && workdir === 0 && stage === 0) return 'D';
  if (stage === 3) return 'U';
  if (workdir === 2) return 'M';
  return undefined;
}

async function ensureDir(dir: string) {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch (err: unknown) {
    const message = (err as Error)?.message ?? '';
    if (!message.includes('already exists')) {
      throw err;
    }
  }
  try {
    await fs.stat(dir);
  } catch {
    await fs.mkdir(dir);
  }
}

async function removeDir(dir: string) {
  try {
    const items = await fs.readdir(dir);
    for (const item of items) {
      const full = joinPath(dir, item);
      const stat = await fs.stat(full);
      if (stat.type === 'dir') {
        await removeDir(full);
      } else {
        await fs.unlink(full);
      }
    }
    await fs.rmdir(dir);
  } catch (err) {
    console.warn('removeDir failed', err);
  }
}

export class GitEngine {
  private ready: Promise<void> | null = null;

  async init() {
    if (!this.ready) {
      this.ready = this.bootstrap();
    }
    return this.ready;
  }

  private async bootstrap() {
    await ensureDir(BASE_DIR);
    await this.ensureDemoRepo();
  }

  private async ensureDemoRepo() {
    const dir = this.resolveRepoDir(DEMO_REPO);
    try {
      await fs.stat(joinPath(dir, '.git'));
      return;
    } catch (_) {
      // continue to seed demo repo
    }

    await ensureDir(dir);
    await git.init({ fs, dir });

    await ensureDir(joinPath(dir, 'src'));
    await ensureDir(joinPath(dir, 'docs'));

    await fs.writeFile(joinPath(dir, 'README.md'), encoder.encode('# GitLane Demo\n\nOffline-first git playground.'));
    await fs.writeFile(joinPath(dir, 'src', 'index.ts'), encoder.encode("export const hello = () => 'GitLane';\n"));
    await fs.writeFile(joinPath(dir, 'docs', 'guide.md'), encoder.encode('## Getting Started\n\nThis is a demo repository managed by isomorphic-git.'));

    await git.add({ fs, dir, filepath: 'README.md' });
    await git.add({ fs, dir, filepath: 'src/index.ts' });
    await git.add({ fs, dir, filepath: 'docs/guide.md' });
    await git.commit({
      fs,
      dir,
      message: 'chore: seed demo repository',
      author: { name: 'GitLane', email: 'demo@gitlane.app' },
      committer: { name: 'GitLane', email: 'demo@gitlane.app' },
    });

    await fs.writeFile(joinPath(dir, 'src', 'status.ts'), encoder.encode('export const status = "ok";\n'));
    await git.add({ fs, dir, filepath: 'src/status.ts' });
    await git.commit({
      fs,
      dir,
      message: 'feat: add status module',
      author: { name: 'GitLane', email: 'demo@gitlane.app' },
      committer: { name: 'GitLane', email: 'demo@gitlane.app' },
    });
  }

  private resolveRepoDir(name: string) {
    return joinPath(BASE_DIR, name);
  }

  async listRepositories(): Promise<Repository[]> {
    await this.init();
    const entries = await fs.readdir(BASE_DIR);
    const repos: Repository[] = [];

    for (const name of entries) {
      const dir = this.resolveRepoDir(name);
      const hasGit = await fs.stat(joinPath(dir, '.git')).catch(() => null);
      if (!hasGit) continue;
      const repo = await this.buildRepository(name, dir);
      repos.push(repo);
    }

    // newest first by last activity
    return repos.sort((a, b) => (a.lastActivity > b.lastActivity ? -1 : 1));
  }

  private async buildRepository(name: string, dir: string): Promise<Repository> {
    const currentBranch = (await git.currentBranch({ fs, dir, fullname: false })) ?? 'main';
    const branches = await git.listBranches({ fs, dir });
    const branchMeta: GitBranch[] = await Promise.all(branches.map(async (branch) => {
      const head = (await git.log({ fs, dir, ref: branch, depth: 1 }))[0];
      return {
        name: branch,
        isRemote: false,
        isCurrent: branch === currentBranch,
        lastCommitSha: head?.oid ?? '',
        lastCommitMessage: head?.commit.message ?? '',
        ahead: 0,
        behind: 0,
      };
    }));

    const statusMatrix = await git.statusMatrix({ fs, dir });
    const stagedCount = statusMatrix.filter(([, , , stage]) => stage === 2 || stage === 3).length;
    const modifiedCount = statusMatrix.filter(([, , workdir, stage]) => workdir === 2 && stage !== 2).length;
    const conflictCount = statusMatrix.filter(([, , , stage]) => stage === 3).length;

    const latestCommit = (await git.log({ fs, dir, depth: 1 }))[0];
    const lastActivity = formatTimestamp(latestCommit?.commit.author.timestamp);
    const commitCount = (await git.log({ fs, dir, depth: 50 })).length;

    return {
      id: name,
      name,
      path: dir,
      currentBranch,
      branches: branchMeta,
      stagedCount,
      modifiedCount,
      conflictCount,
      lastActivity,
      size: '—',
      commitCount,
    };
  }

  async getWorkingTree(repoId: string): Promise<GitFile[]> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);
    const statusMatrix = await git.statusMatrix({ fs, dir });
    const tracked = await git.listFiles({ fs, dir });
    const all = Array.from(new Set([...tracked, ...statusMatrix.map(([filepath]) => filepath)]));

    const tree: GitFile[] = [];

    for (const filepath of all) {
      const statusEntry = statusMatrix.find(([p]) => p === filepath) ?? null;
      const head = statusEntry?.[1] ?? 0;
      const workdir = statusEntry?.[2] ?? 0;
      const stage = statusEntry?.[3] ?? 0;
      const status = ensureStatus(head, workdir, stage);
      const changeType = changeTypeFromStatus(head, workdir, stage);

      const fullPath = joinPath(dir, filepath);
      const stat = await fs.stat(fullPath).catch(() => null);
      const isDirectory = stat?.type === 'dir';
      const size = stat?.size ?? 0;
      const segments = filepath.split('/');
      const fileName = segments[segments.length - 1];
      const extension = fileName.includes('.') ? fileName.split('.').pop() : undefined;

      let content: string | undefined;
      if (!isDirectory) {
        try {
          const buf = await fs.readFile(fullPath);
          content = decoder.decode(buf as ArrayBuffer);
        } catch (_) {
          content = undefined;
        }
      }

      const fileNode: GitFile = {
        id: filepath,
        name: fileName,
        path: '/' + filepath,
        isDirectory: isDirectory ?? false,
        size,
        extension,
        status,
        changeType,
        modifiedAt: undefined,
        content,
      };

      this.insertIntoTree(tree, segments, fileNode);
    }

    return tree;
  }

  private insertIntoTree(tree: GitFile[], segments: string[], file: GitFile) {
    if (segments.length === 0) return;
    const [head, ...rest] = segments;
    if (rest.length === 0) {
      const existingIndex = tree.findIndex(f => f.name === head);
      if (existingIndex !== -1) {
        tree[existingIndex] = { ...tree[existingIndex], ...file };
      } else {
        tree.push(file);
      }
      return;
    }

    let dirNode = tree.find(f => f.name === head && f.isDirectory);
    if (!dirNode) {
      dirNode = {
        id: randomId(),
        name: head,
        path: '/' + segments.slice(0, segments.length - rest.length).join('/'),
        isDirectory: true,
        children: [],
      };
      tree.push(dirNode);
    }
    if (!dirNode.children) dirNode.children = [];
    this.insertIntoTree(dirNode.children, rest, file);
  }

  async getCommits(repoId: string): Promise<GitCommit[]> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);
    const commits = await git.log({ fs, dir, depth: 50 });
    return commits.map((entry) => ({
      sha: entry.oid,
      shortSha: entry.oid.slice(0, 7),
      message: entry.commit.message,
      author: entry.commit.author.name,
      email: entry.commit.author.email,
      date: formatTimestamp(entry.commit.author.timestamp),
      parents: entry.commit.parent ?? [],
      branches: [],
      isMerge: (entry.commit.parent ?? []).length > 1,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
    }));
  }

  async createRepository(name: string, addReadme: boolean): Promise<Repository> {
    await this.init();
    const safeName = name.trim().replace(/\s+/g, '-');
    const dir = this.resolveRepoDir(safeName);
    await ensureDir(dir);
    await git.init({ fs, dir });

    if (addReadme) {
      await fs.writeFile(joinPath(dir, 'README.md'), encoder.encode(`# ${name}\n`));
      await git.add({ fs, dir, filepath: 'README.md' });
      await git.commit({
        fs,
        dir,
        message: 'chore: initial commit',
        author: { name: 'GitLane User', email: 'user@gitlane.app' },
        committer: { name: 'GitLane User', email: 'user@gitlane.app' },
      });
    }

    return this.buildRepository(safeName, dir);
  }

  async deleteRepository(id: string) {
    const dir = this.resolveRepoDir(id);
    await removeDir(dir);
  }

  async stageFile(repoId: string, filepath: string) {
    const dir = this.resolveRepoDir(repoId);
    await git.add({ fs, dir, filepath });
  }

  async unstageFile(repoId: string, filepath: string) {
    const dir = this.resolveRepoDir(repoId);
    await git.resetIndex({ fs, dir, filepath });
  }

  async commit(repoId: string, message: string, author: { name: string; email: string; }) {
    const dir = this.resolveRepoDir(repoId);
    await git.commit({ fs, dir, message, author, committer: author });
  }

  async switchBranch(repoId: string, branch: string) {
    const dir = this.resolveRepoDir(repoId);
    await git.checkout({ fs, dir, ref: branch });
  }

  async createBranch(repoId: string, branch: string) {
    const dir = this.resolveRepoDir(repoId);
    await git.branch({ fs, dir, ref: branch, checkout: true });
  }
}

export const gitEngine = new GitEngine();
