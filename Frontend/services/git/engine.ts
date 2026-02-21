import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { expoFS } from "./expo-fs";
import type {
  Repository,
  GitFile,
  GitCommit,
  GitBranch,
  FileStatus,
  ChangeType,
} from "@/types/git";

// ─── P2P diff types ──────────────────────────────────────────────────────────

export interface CommitDiffFile {
  filepath: string;
  oldContent: string;
  newContent: string;
  changeType: "M" | "A" | "D";
}

// Minimal interface matching what isomorphic-git passes into git.walk map()
interface WalkerEntry {
  oid(): Promise<string>;
  type(): Promise<"blob" | "tree" | "commit" | "tag">;
  mode(): Promise<number>;
  content(): Promise<Uint8Array | void>;
}


// ---------------------------------------------------------------------------
// File-system & constants
// ---------------------------------------------------------------------------

// `fs` is our custom Expo-native adapter – NO IndexedDB, NO LightningFS
const fs = expoFS;

// All git paths are POSIX under /repos/*  (mapped to Expo documentDirectory)
const BASE_DIR = "/repos";
// Demo repo removed

const TAG = "[GitEngine]";

// ---------------------------------------------------------------------------
// Transaction helpers  (written into .git via ExpoFS)
// ---------------------------------------------------------------------------

export interface TransactionEntry {
  id: string;
  type: "commit" | "merge" | "branch" | "clone" | "pull";
  status: "PENDING" | "COMPLETED" | "FAILED";
  message?: string;
  startedAt: number;
  completedAt?: number;
}

function txFilePath(dir: string) {
  return joinPath(dir, ".git", "gitlane_transactions.json");
}

function cacheFilePath(dir: string) {
  return joinPath(dir, ".git", "gitlane_cache.json");
}

async function readTransactions(dir: string): Promise<TransactionEntry[]> {
  try {
    const raw = await fs.promises.readFile(txFilePath(dir), "utf8");
    return JSON.parse(raw as string) as TransactionEntry[];
  } catch {
    return [];
  }
}

async function writeTransactions(dir: string, entries: TransactionEntry[]) {
  await fs.promises.writeFile(
    txFilePath(dir),
    JSON.stringify(entries, null, 2),
    "utf8"
  );
  console.log(TAG, `TX log updated â†’ ${entries.length} entries`);
}

async function appendTx(dir: string, entry: TransactionEntry) {
  const list = await readTransactions(dir);
  list.push(entry);
  await writeTransactions(dir, list);
}

async function completeTx(dir: string, txId: string) {
  const list = await readTransactions(dir);
  const idx = list.findIndex((e) => e.id === txId);
  if (idx !== -1) {
    list[idx].status = "COMPLETED";
    list[idx].completedAt = Date.now();
  }
  await writeTransactions(dir, list);
}

async function failTx(dir: string, txId: string) {
  const list = await readTransactions(dir);
  const idx = list.findIndex((e) => e.id === txId);
  if (idx !== -1) {
    list[idx].status = "FAILED";
    list[idx].completedAt = Date.now();
  }
  await writeTransactions(dir, list);
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

async function deleteGitCache(dir: string) {
  try {
    await fs.promises.unlink(cacheFilePath(dir));
    console.log(TAG, `Cache deleted â†’ ${cacheFilePath(dir)}`);
  } catch {
    // file didn't exist â€“ fine
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function joinPath(...parts: string[]): string {
  return parts.join("/").replace(/\\/g, "/");
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "just now";
  const diffMs = Date.now() - timestamp * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function ensureStatus(
  head: number,
  workdir: number,
  stage: number
): FileStatus {
  if (head === 0 && workdir === 2 && stage === 0) return "untracked";
  if (workdir === 2 && stage === 2) return "staged";
  if (workdir === 2 && stage !== 2) return "modified";
  if (head === 1 && workdir === 0 && stage === 0) return "untracked";
  return "modified";
}

function changeTypeFromStatus(
  head: number,
  workdir: number,
  stage: number
): ChangeType | undefined {
  if (head === 0 && workdir === 2) return "A";
  if (head === 1 && workdir === 0 && stage === 0) return "D";
  if (stage === 3) return "U";
  if (workdir === 2) return "M";
  return undefined;
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function ensureDirDeep(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function removeDir(dir: string) {
  try {
    // ExpoFS rmdir deletes recursively
    await fs.promises.rmdir(dir);
  } catch (err) {
    console.warn(TAG, "removeDir failed", err);
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
    console.log(TAG, `Bootstrapping â€“ BASE_DIR = ${BASE_DIR}`);
    await ensureDirDeep(BASE_DIR);
    console.log(TAG, "Bootstrap complete âœ“");
  }

  // Demo seeding removed

  resolveRepoDir(name: string) {
    return joinPath(BASE_DIR, name);
  }

  // â”€â”€ Clone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async cloneRepo(
    url: string,
    name: string,
    onProgress?: (phase: string, loaded: number, total: number) => void,
    token?: string
  ): Promise<Repository> {
    await this.init();
    const safeName = name.trim().replace(/\s+/g, "-");
    const dir = this.resolveRepoDir(safeName);
    const txId = randomId();
    console.log(TAG, `clone START â†’ ${url} into ${dir}`);

    await ensureDirDeep(dir);
    await git.init({ fs, dir }); // need .git before we can write tx log

    await appendTx(dir, {
      id: txId,
      type: "clone",
      status: "PENDING",
      message: url,
      startedAt: Date.now(),
    });

    try {
      await git.clone({
        fs,
        http,
        dir,
        url,
        singleBranch: true,
        depth: 50,
        onAuth: token ? () => ({ username: token, password: "" }) : undefined,
        onProgress: onProgress
          ? (evt) => onProgress(evt.phase, evt.loaded, evt.total ?? 0)
          : undefined,
      });
      await completeTx(dir, txId);
      await deleteGitCache(dir);
      console.log(TAG, `clone COMPLETE â†’ ${safeName}`);
      return this.buildRepository(safeName, dir);
    } catch (err) {
      await failTx(dir, txId);
      console.error(TAG, `clone FAILED â†’ ${safeName}`, err);
      throw err;
    }
  }

  async push(repoId: string, token: string): Promise<void> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);
    const ref =
      (await git.currentBranch({ fs, dir, fullname: false })) ?? "main";
    const txId = randomId();
    await appendTx(dir, {
      id: txId,
      type: "pull",
      status: "PENDING",
      message: `push ${ref}`,
      startedAt: Date.now(),
    });
    try {
      await git.push({
        fs,
        http,
        dir,
        remote: "origin",
        ref,
        onAuth: () => ({ username: token, password: "" }),
      });
      await completeTx(dir, txId);
      await deleteGitCache(dir);
      console.log(TAG, `push COMPLETE â†’ ${repoId} (${ref})`);
    } catch (err) {
      await failTx(dir, txId);
      console.error(TAG, `push FAILED â†’ ${repoId}`, err);
      throw err;
    }
  }

  // â”€â”€ List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async listRepositories(): Promise<Repository[]> {
    await this.init();
    let entries: string[] = [];
    try {
      entries = await fs.promises.readdir(BASE_DIR);
    } catch (err) {
      console.warn(TAG, "listRepositories: readdir failed", err);
      return [];
    }
    const repos: Repository[] = [];
    console.log(
      TAG,
      `listRepositories â€“ scanning ${BASE_DIR}, found: [${entries.join(
        ", "
      )}]`
    );

    for (const name of entries) {
      const dir = this.resolveRepoDir(name);
      const hasGit = await fs.promises
        .stat(joinPath(dir, ".git"))
        .catch(() => null);
      if (!hasGit) continue;
      try {
        const repo = await this.buildRepository(name, dir);
        repos.push(repo);
      } catch (err) {
        console.warn(
          TAG,
          `listRepositories: buildRepository("${name}") failed`,
          err
        );
      }
    }

    // newest first by last activity
    return repos.sort((a, b) => (a.lastActivity > b.lastActivity ? -1 : 1));
  }

  private async buildRepository(
    name: string,
    dir: string
  ): Promise<Repository> {
    const currentBranch =
      (await git.currentBranch({ fs, dir, fullname: false })) ?? "main";
    const branches = await git.listBranches({ fs, dir });
    const branchMeta: GitBranch[] = await Promise.all(
      branches.map(async (branch) => {
        const head = (await git.log({ fs, dir, ref: branch, depth: 1 }))[0];
        return {
          name: branch,
          isRemote: false,
          isCurrent: branch === currentBranch,
          lastCommitSha: head?.oid ?? "",
          lastCommitMessage: head?.commit.message ?? "",
          ahead: 0,
          behind: 0,
        };
      })
    );

    const statusMatrix = await git.statusMatrix({ fs, dir });
    const stagedCount = statusMatrix.filter(
      ([, , , stage]) => stage === 2 || stage === 3
    ).length;
    const modifiedCount = statusMatrix.filter(
      ([, , workdir, stage]) => workdir === 2 && stage !== 2
    ).length;
    const conflictCount = statusMatrix.filter(
      ([, , , stage]) => stage === 3
    ).length;

    const latestCommit = (await git.log({ fs, dir, depth: 1 }))[0];
    const lastActivity = formatTimestamp(latestCommit?.commit.author.timestamp);
    const commitCount = (await git.log({ fs, dir, depth: 50 })).length;

    console.log(
      TAG,
      `buildRepo(${name}) â€“ branch=${currentBranch} commits=${commitCount} staged=${stagedCount} modified=${modifiedCount}`
    );

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
      size: "â€”",
      commitCount,
    };
  }

  async getWorkingTree(repoId: string): Promise<GitFile[]> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);
    console.log(TAG, `getWorkingTree(${repoId})`);
    const statusMatrix = await git.statusMatrix({ fs, dir });
    const tracked = await git.listFiles({ fs, dir });
    const all = Array.from(
      new Set([...tracked, ...statusMatrix.map(([filepath]) => filepath)])
    );

    const tree: GitFile[] = [];

    for (const filepath of all) {
      const statusEntry = statusMatrix.find(([p]) => p === filepath) ?? null;
      const head = statusEntry?.[1] ?? 0;
      const workdir = statusEntry?.[2] ?? 0;
      const stage = statusEntry?.[3] ?? 0;
      const status = ensureStatus(head, workdir, stage);
      const changeType = changeTypeFromStatus(head, workdir, stage);

      const fullPath = joinPath(dir, filepath);
      const stat = await fs.promises.stat(fullPath).catch(() => null);
      const isDirectory = stat?.type === "dir";
      const size = stat?.size ?? 0;
      const segments = filepath.split("/");
      const fileName = segments[segments.length - 1];
      const extension = fileName.includes(".")
        ? fileName.split(".").pop()
        : undefined;

      let content: string | undefined;
      if (!isDirectory) {
        try {
          const buf = await fs.promises.readFile(fullPath, "utf8");
          content = buf as string;
        } catch (_) {
          content = undefined;
        }
      }

      const fileNode: GitFile = {
        id: filepath,
        name: fileName,
        path: "/" + filepath,
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
      const existingIndex = tree.findIndex((f) => f.name === head);
      if (existingIndex !== -1) {
        tree[existingIndex] = { ...tree[existingIndex], ...file };
      } else {
        tree.push(file);
      }
      return;
    }

    let dirNode = tree.find((f) => f.name === head && f.isDirectory);
    if (!dirNode) {
      dirNode = {
        id: randomId(),
        name: head,
        path: "/" + segments.slice(0, segments.length - rest.length).join("/"),
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
    console.log(TAG, `getCommits(${repoId}) â†’ ${commits.length} commits`);
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

  // ── getCommitDiff ────────────────────────────────────────────────────────
  // Returns file-level diff data (old blob + new blob) for a single commit.
  // Uses isomorphic-git tree walkers to read actual file content from the
  // object store — no working directory access required.

  async getCommitDiff(
    repoId: string,
    sha: string
  ): Promise<CommitDiffFile[]> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);

    // Get the commit's parent(s) — limit depth:2 to keep it fast
    const log = await git.log({ fs, dir, ref: sha, depth: 2 });
    const parentSha = log[1]?.oid ?? null;

    const decode = async (entry: WalkerEntry | null): Promise<string> => {
      if (!entry) return "";
      try {
        const bytes = await entry.content();
        if (!bytes) return "";
        return new TextDecoder().decode(bytes as Uint8Array);
      } catch {
        return "";
      }
    };

    if (!parentSha) {
      // Initial commit — every file in the tree is "added"
      const results: CommitDiffFile[] = [];
      await git.walk({
        fs,
        dir,
        trees: [git.TREE({ ref: sha })],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map: async (filepath: string, entries: any[]) => {
          const entry: WalkerEntry | null = entries[0];
          if (filepath === ".") return null;
          const type = await entry?.type();
          if (type !== "blob") return null;
          const newContent = await decode(entry);
          results.push({ filepath, oldContent: "", newContent, changeType: "A" });
          return null;
        },
      });
      return results;
    }

    // Normal commit — compare parent tree vs current tree
    type RawEntry = CommitDiffFile | null;
    const walked = (await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref: parentSha }), git.TREE({ ref: sha })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map: async (filepath: string, entries: any[]): Promise<RawEntry> => {
        const parentEntry: WalkerEntry | null = entries[0];
        const currentEntry: WalkerEntry | null = entries[1];
        if (filepath === ".") return null;

        const [parentType, currentType] = await Promise.all([
          parentEntry?.type(),
          currentEntry?.type(),
        ]);
        // Skip directory nodes
        if (parentType === "tree" || currentType === "tree") return null;

        const [parentOid, currentOid] = await Promise.all([
          parentEntry?.oid(),
          currentEntry?.oid(),
        ]);
        // Skip unchanged files
        if (parentOid && currentOid && parentOid === currentOid) return null;

        const [oldContent, newContent] = await Promise.all([
          decode(parentEntry ?? null),
          decode(currentEntry ?? null),
        ]);

        const changeType: "M" | "A" | "D" =
          !parentEntry ? "A" : !currentEntry ? "D" : "M";

        return { filepath, oldContent, newContent, changeType };
      },
    })) as RawEntry[];

    return walked.filter((r): r is CommitDiffFile => r !== null);
  }

  // ── getRemoteUrl ─────────────────────────────────────────────────────────
  // Reads the 'remote.origin.url' git config value for a repo.
  // Returns null if the repo has no remote (locally created repos).

  async getRemoteUrl(repoId: string): Promise<string | null> {
    await this.init();
    const dir = this.resolveRepoDir(repoId);
    try {
      const url = await git.getConfig({ fs, dir, path: 'remote.origin.url' });
      return (url as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async createRepository(
    name: string,
    addReadme: boolean
  ): Promise<Repository> {
    await this.init();
    const safeName = name.trim().replace(/\s+/g, "-");
    const dir = this.resolveRepoDir(safeName);
    console.log(TAG, `createRepository(${safeName}) â†’ ${dir}`);
    await ensureDirDeep(dir);
    await git.init({ fs, dir });

    if (addReadme) {
      await fs.promises.writeFile(joinPath(dir, "README.md"), `# ${name}\n`);
      await git.add({ fs, dir, filepath: "README.md" });
      await git.commit({
        fs,
        dir,
        message: "chore: initial commit",
        author: { name: "GitLane User", email: "user@gitlane.app" },
        committer: { name: "GitLane User", email: "user@gitlane.app" },
      });
    }

    return this.buildRepository(safeName, dir);
  }

  async deleteRepository(id: string) {
    const dir = this.resolveRepoDir(id);
    console.log(TAG, `deleteRepository(${id}) â†’ removing ${dir}`);
    await removeDir(dir);
  }

  // â”€â”€ Stage / Unstage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async stageFile(repoId: string, filepath: string) {
    const dir = this.resolveRepoDir(repoId);
    console.log(TAG, `stage ${filepath} in ${repoId}`);
    await git.add({ fs, dir, filepath });
  }

  async unstageFile(repoId: string, filepath: string) {
    const dir = this.resolveRepoDir(repoId);
    console.log(TAG, `unstage ${filepath} in ${repoId}`);
    await git.resetIndex({ fs, dir, filepath });
  }

  // â”€â”€ Commit (TX-wrapped + 3 s test delay) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async commit(
    repoId: string,
    message: string,
    author: { name: string; email: string }
  ) {
    const dir = this.resolveRepoDir(repoId);
    const txId = randomId();

    // 1. PENDING
    await appendTx(dir, {
      id: txId,
      type: "commit",
      status: "PENDING",
      message,
      startedAt: Date.now(),
    });
    console.log(TAG, `commit PENDING (txId=${txId}) in ${repoId}`);

    try {
      await git.commit({ fs, dir, message, author, committer: author });

      // â±  3-second intentional delay â€” kill app in this window to test recovery
      console.log(
        TAG,
        `commit succeeded â€“ 3 s delay before COMPLETED (test crash-recovery)â€¦`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 2. COMPLETED + invalidate cache
      await completeTx(dir, txId);
      await deleteGitCache(dir);
      console.log(TAG, `commit COMPLETED (txId=${txId}) in ${repoId}`);
    } catch (err) {
      await failTx(dir, txId);
      console.error(TAG, `commit FAILED (txId=${txId})`, err);
      throw err;
    }
  }

  // â”€â”€ Branch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async switchBranch(repoId: string, branch: string) {
    const dir = this.resolveRepoDir(repoId);
    console.log(TAG, `switchBranch(${repoId}, ${branch})`);
    await git.checkout({ fs, dir, ref: branch });
    console.log(TAG, `switchBranch â†’ now on ${branch}`);
  }

  async createBranch(repoId: string, branch: string) {
    const dir = this.resolveRepoDir(repoId);
    const txId = randomId();

    await appendTx(dir, {
      id: txId,
      type: "branch",
      status: "PENDING",
      message: `create ${branch}`,
      startedAt: Date.now(),
    });
    console.log(TAG, `createBranch PENDING (txId=${txId}) â†’ ${branch}`);

    try {
      await git.branch({ fs, dir, ref: branch, checkout: true });
      await completeTx(dir, txId);
      await deleteGitCache(dir);
      console.log(TAG, `createBranch COMPLETED â†’ ${branch}`);
    } catch (err) {
      await failTx(dir, txId);
      console.error(TAG, `createBranch FAILED â†’ ${branch}`, err);
      throw err;
    }
  }

  // â”€â”€ Merge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async merge(
    repoId: string,
    theirBranch: string,
    author: { name: string; email: string }
  ) {
    const dir = this.resolveRepoDir(repoId);
    const txId = randomId();

    await appendTx(dir, {
      id: txId,
      type: "merge",
      status: "PENDING",
      message: `merge ${theirBranch}`,
      startedAt: Date.now(),
    });
    console.log(TAG, `merge PENDING (txId=${txId}) â€“ merging ${theirBranch}`);

    try {
      const current =
        (await git.currentBranch({ fs, dir, fullname: false })) ?? "main";
      await git.merge({ fs, dir, ours: current, theirs: theirBranch, author });
      await completeTx(dir, txId);
      await deleteGitCache(dir);
      console.log(TAG, `merge COMPLETED (txId=${txId})`);
    } catch (err) {
      await failTx(dir, txId);
      console.error(TAG, `merge FAILED (txId=${txId})`, err);
      throw err;
    }
  }

  // â”€â”€ Recovery: find PENDING transactions across all repos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getPendingTransactions(): Promise<
    { repoId: string; dir: string; entries: TransactionEntry[] }[]
  > {
    await this.init();
    const results: {
      repoId: string;
      dir: string;
      entries: TransactionEntry[];
    }[] = [];
    const entries = await fs.promises.readdir(BASE_DIR);

    for (const name of entries) {
      const dir = this.resolveRepoDir(name);
      const hasGit = await fs.promises
        .stat(joinPath(dir, ".git"))
        .catch(() => null);
      if (!hasGit) continue;

      const txList = await readTransactions(dir);
      const pending = txList.filter((e) => e.status === "PENDING");
      if (pending.length > 0) {
        console.warn(
          TAG,
          `âš  PENDING transactions in ${name}:`,
          pending.map((p) => `${p.type}(${p.id})`).join(", ")
        );
        results.push({ repoId: name, dir, entries: pending });
      }
    }

    return results;
  }
}

export const gitEngine = new GitEngine();
