/**
 * P2P Transfer Service
 *
 * Transport is abstracted — default is AsyncStorage relay (same-device demo).
 * Swap storeSession/getSession for WebSocket/TCP to go real multi-device.
 *
 * Diff generation uses real isomorphic-git blob reads via gitEngine.getCommitDiff,
 * combined with a Myers O(ND) line-diff algorithm — no mock data anywhere.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { gitEngine } from '@/services/git/engine';
import {
  fetchGitHubCommitFiles,
  parseGitHubRemoteUrl,
  type GitHubFilePatch,
} from '@/services/github/api';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface QRPayload {
  type: 'gitlane-transfer';
  version: '1.0';
  sessionToken: string;
  deviceIp: string;
  port: number;
  repoName: string;
  repoId: string;
  commits: string[]; // full SHAs of selected commits
  senderName: string;
  timestamp: number;
  // GitHub coordinates so the receiver can fetch diffs via the API
  // even when they don't have the same repo cloned locally.
  githubOwner?: string;
  githubRepo?: string;
}

export interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'hunk' | 'header';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  filepath: string;
  oldFilepath?: string;
  changeType: 'M' | 'A' | 'D' | 'R';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export type P2PSessionState = 'pending' | 'connected' | 'complete' | 'error';

export interface P2PSession {
  sessionToken: string;
  repoId: string;
  repoName: string;
  senderName: string;
  commits: string[];
  diffFiles: DiffFile[];
  state: P2PSessionState;
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_PREFIX = 'gitlane:p2p:session:';
const DEFAULT_PORT = 8765;
const CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 2000; // safety cap per file

// ─── Token & IP ──────────────────────────────────────────────────────────────

export function generateSessionToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export async function getDeviceIP(): Promise<string> {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// ─── QR encoding ─────────────────────────────────────────────────────────────

export function buildQRPayload(
  repoId: string,
  repoName: string,
  commits: string[],
  deviceIp: string,
  sessionToken: string,
  senderName: string,
  githubOwner?: string | null,
  githubRepo?: string | null,
): QRPayload {
  const payload: QRPayload = {
    type: 'gitlane-transfer',
    version: '1.0',
    sessionToken,
    deviceIp,
    port: DEFAULT_PORT,
    repoName,
    repoId,
    commits,
    senderName,
    timestamp: Date.now(),
  };
  if (githubOwner) payload.githubOwner = githubOwner;
  if (githubRepo) payload.githubRepo = githubRepo;
  return payload;
}

export function encodeQRPayload(payload: QRPayload): string {
  return JSON.stringify(payload);
}

export function decodeQRPayload(data: string): QRPayload | null {
  try {
    const parsed = JSON.parse(data) as QRPayload;
    if (parsed.type !== 'gitlane-transfer') return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Myers O(ND) line-diff algorithm ─────────────────────────────────────────

type EditOp = { op: 'keep' | 'add' | 'del'; text: string };

function myersDiff(a: string[], b: string[]): EditOp[] {
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map(text => ({ op: 'add' as const, text }));
  if (m === 0) return a.map(text => ({ op: 'del' as const, text }));

  // Cap to prevent O(N^2) memory on very large files
  if (n + m > MAX_DIFF_LINES) {
    return [
      ...a.map(text => ({ op: 'del' as const, text })),
      ...b.map(text => ({ op: 'add' as const, text })),
    ];
  }

  const max = n + m;
  const offset = max + 1;
  const size = 2 * max + 3;
  const v = new Int32Array(size).fill(-1);
  const history: Int32Array[] = [];
  v[offset + 1] = 0;

  let foundD = -1;
  outer: for (let d = 0; d <= max; d++) {
    history.push(Int32Array.from(v));
    for (let k = -d; k <= d; k += 2) {
      const ki = k + offset;
      let x: number;
      if (k === -d || (k !== d && v[ki - 1] < v[ki + 1])) {
        x = v[ki + 1]; // move down (insert)
      } else {
        x = v[ki - 1] + 1; // move right (delete)
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; } // snake
      v[ki] = x;
      if (x >= n && y >= m) { foundD = d; break outer; }
    }
  }

  if (foundD < 0) {
    return [...a.map(t => ({ op: 'del' as const, text: t })),
            ...b.map(t => ({ op: 'add' as const, text: t }))];
  }

  // Backtrack
  const script: EditOp[] = [];
  let x = n, y = m;
  for (let d = foundD; d > 0; d--) {
    const vh = history[d];
    const k = x - y;
    const ki = k + offset;
    const prevK = (k === -d || (k !== d && vh[ki - 1] < vh[ki + 1])) ? k + 1 : k - 1;
    const prevX = vh[prevK + offset];
    const prevY = prevX - prevK;
    // snake moves
    while (x > prevX && y > prevY) {
      script.unshift({ op: 'keep', text: a[x - 1] });
      x--; y--;
    }
    if (x === prevX) {
      script.unshift({ op: 'add', text: b[y - 1] });
      y--;
    } else {
      script.unshift({ op: 'del', text: a[x - 1] });
      x--;
    }
  }
  // remaining leading keeps
  while (x > 0 && y > 0) { script.unshift({ op: 'keep', text: a[x - 1] }); x--; y--; }

  return script;
}

// ─── Build DiffHunks from edit script ────────────────────────────────────────

function buildHunks(script: EditOp[]): DiffHunk[] {
  const n = script.length;
  if (n === 0) return [];

  const changeAt = script.reduce<number[]>((acc, s, i) => {
    if (s.op !== 'keep') acc.push(i);
    return acc;
  }, []);
  if (changeAt.length === 0) return [];

  // Merge nearby changes into spans
  const spans: Array<[number, number]> = [];
  let start = Math.max(0, changeAt[0] - CONTEXT_LINES);
  let end = Math.min(n - 1, changeAt[0] + CONTEXT_LINES);
  for (let ci = 1; ci < changeAt.length; ci++) {
    const ns = Math.max(0, changeAt[ci] - CONTEXT_LINES);
    if (ns <= end + 1) {
      end = Math.min(n - 1, changeAt[ci] + CONTEXT_LINES);
    } else {
      spans.push([start, end]);
      start = ns;
      end = Math.min(n - 1, changeAt[ci] + CONTEXT_LINES);
    }
  }
  spans.push([start, end]);

  const hunks: DiffHunk[] = [];

  for (const [spanStart, spanEnd] of spans) {
    // Count lines before this span to get base numbers
    let oldBase = 1, newBase = 1;
    for (let i = 0; i < spanStart; i++) {
      if (script[i].op !== 'add') oldBase++;
      if (script[i].op !== 'del') newBase++;
    }

    let oldCount = 0, newCount = 0;
    const lines: DiffLine[] = [];

    for (let i = spanStart; i <= spanEnd; i++) {
      const { op, text } = script[i];
      if (op === 'keep') {
        lines.push({ type: 'context', content: ' ' + text, oldLineNo: oldBase + oldCount, newLineNo: newBase + newCount });
        oldCount++; newCount++;
      } else if (op === 'del') {
        lines.push({ type: 'removed', content: '-' + text, oldLineNo: oldBase + oldCount });
        oldCount++;
      } else {
        lines.push({ type: 'added', content: '+' + text, newLineNo: newBase + newCount });
        newCount++;
      }
    }

    hunks.push({
      header: `@@ -${oldBase},${oldCount} +${newBase},${newCount} @@`,
      lines,
    });
  }

  return hunks;
}

// ─── Real diff build from gitEngine ──────────────────────────────────────────
/**
 * Parses a GitHub unified-diff patch string (from the API) into DiffHunk[].
 * The patch looks like:
 *   @@ -1,4 +1,5 @@ optional text\n context\n-removed\n+added\n context
 */
function parsePatchToHunks(patch: string): DiffHunk[] {
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      if (currentHunk) hunks.push(currentHunk);
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentHunk = { header: line, lines: [] };
      continue;
    }
    if (!currentHunk) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({ type: 'added', content: line, newLineNo: newLine++ });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({ type: 'removed', content: line, oldLineNo: oldLine++ });
    } else {
      // context line (leading space or empty)
      currentHunk.lines.push({
        type: 'context',
        content: line.startsWith(' ') ? line : ' ' + line,
        oldLineNo: oldLine++,
        newLineNo: newLine++,
      });
    }
  }
  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

function githubStatusToChangeType(status: GitHubFilePatch['status']): 'M' | 'A' | 'D' | 'R' {
  if (status === 'added') return 'A';
  if (status === 'removed') return 'D';
  if (status === 'renamed') return 'R';
  return 'M';
}
function isBinary(content: string): boolean {
  // Treat as binary if the first 8KB contains null bytes
  const sample = content.slice(0, 8192);
  return sample.includes('\x00');
}

function diffFileFromBlobs(
  filepath: string,
  oldContent: string,
  newContent: string,
  changeType: 'M' | 'A' | 'D',
): DiffFile {
  // Skip binary files
  if (isBinary(oldContent) || isBinary(newContent)) {
    return {
      filepath,
      changeType,
      additions: 0,
      deletions: 0,
      hunks: [{
        header: '@@ binary file @@',
        lines: [{ type: 'header', content: ' Binary file — content not shown' }],
      }],
    };
  }

  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  // Remove trailing empty line from git blob
  if (oldLines[oldLines.length - 1] === '') oldLines.pop();
  if (newLines[newLines.length - 1] === '') newLines.pop();

  if (changeType === 'A') {
    // All lines added — no need to run Myers
    const lines: DiffLine[] = newLines.map((text, i) => ({
      type: 'added',
      content: '+' + text,
      newLineNo: i + 1,
    }));
    return {
      filepath,
      changeType: 'A',
      additions: newLines.length,
      deletions: 0,
      hunks: lines.length > 0 ? [{ header: `@@ -0,0 +1,${newLines.length} @@`, lines }] : [],
    };
  }

  if (changeType === 'D') {
    const lines: DiffLine[] = oldLines.map((text, i) => ({
      type: 'removed',
      content: '-' + text,
      oldLineNo: i + 1,
    }));
    return {
      filepath,
      changeType: 'D',
      additions: 0,
      deletions: oldLines.length,
      hunks: lines.length > 0 ? [{ header: `@@ -1,${oldLines.length} +0,0 @@`, lines }] : [],
    };
  }

  const script = myersDiff(oldLines, newLines);
  const additions = script.filter(s => s.op === 'add').length;
  const deletions = script.filter(s => s.op === 'del').length;
  const hunks = buildHunks(script);

  return { filepath, changeType, additions, deletions, hunks };
}

/**
 * Builds real DiffFile[] for a set of commit SHAs in a repo.
 *
 * Strategy (in priority order):
 *   1. GitHub API — if githubToken is provided AND the repo has a github remote,
 *      fetch pre-computed patches from
 *      GET /repos/{owner}/{repo}/commits/{sha}.
 *      This is the most accurate source since GitHub already computed the diff.
 *   2. Local isomorphic-git blob diff — fallback for locally-created repos
 *      or when GitHub API is unavailable/unauthenticated.
 *
 * Results are accumulated per-file across all selected commits.
 * When the same file appears in multiple commits, changes are merged:
 * the oldest old-content is kept as the base, the newest new-content
 * is used for the final Myers diff (local path only).
 */
export async function buildRealDiffFiles(
  repoId: string,
  commitShas: string[],
  githubToken?: string | null,
  // Explicit owner/repo override — set by receiver using values baked into the QR payload.
  // Takes priority over resolving the remote URL from local git config.
  githubOwnerOverride?: string | null,
  githubRepoOverride?: string | null,
): Promise<DiffFile[]> {
  if (commitShas.length === 0) return [];

  // Resolve GitHub coordinates: explicit override first, then local remote config
  let githubInfo: { owner: string; repo: string } | null = null;
  if (githubToken) {
    if (githubOwnerOverride && githubRepoOverride) {
      githubInfo = { owner: githubOwnerOverride, repo: githubRepoOverride };
    } else {
      const remoteUrl = await gitEngine.getRemoteUrl(repoId).catch(() => null);
      githubInfo = remoteUrl ? parseGitHubRemoteUrl(remoteUrl) : null;
    }
  }

  // ── Path 1: GitHub API ─────────────────────────────────────────────────
  if (githubInfo && githubToken) {
    const { owner, repo } = githubInfo;
    // filepath -> latest DiffFile (last commit touching a file wins for hunks)
    const fileMap = new Map<string, DiffFile>();

    for (const sha of commitShas) {
      try {
        const patches = await fetchGitHubCommitFiles(owner, repo, sha, githubToken);
        for (const p of patches) {
          const hunks = p.patch ? parsePatchToHunks(p.patch) : [];
          const allLines = hunks.flatMap(h => h.lines);
          const additions = allLines.filter(l => l.type === 'added').length || p.additions;
          const deletions = allLines.filter(l => l.type === 'removed').length || p.deletions;
          const changeType = githubStatusToChangeType(p.status);

          const existing = fileMap.get(p.filename);
          if (!existing) {
            fileMap.set(p.filename, {
              filepath: p.filename,
              oldFilepath: p.previous_filename,
              changeType,
              additions,
              deletions,
              hunks,
            });
          } else {
            // Same file modified in multiple commits: append new hunks and accumulate stats
            existing.hunks = [...existing.hunks, ...hunks];
            existing.additions += additions;
            existing.deletions += deletions;
            existing.changeType = changeType; // latest commit's status wins
          }
        }
      } catch (err) {
        console.warn('[P2P] GitHub API diff failed for', sha, '— falling back to local blobs');
        // If GitHub fails mid-loop, fall through to local fallback below
        return buildLocalDiffFiles(repoId, commitShas);
      }
    }

    const result = Array.from(fileMap.values());
    if (result.length > 0) return result;
    // Empty result (e.g. merge commit with no file changes) — let local fallback try
  }

  // ── Path 2: Local isomorphic-git blob diff ────────────────────────────
  return buildLocalDiffFiles(repoId, commitShas);
}

/**
 * Local fallback: reads blob content via git.walk and runs Myers diff.
 */
async function buildLocalDiffFiles(
  repoId: string,
  commitShas: string[],
): Promise<DiffFile[]> {
  // filepath -> { oldest old-content, newest new-content, changeType }
  const blobMap = new Map<string, { oldContent: string; newContent: string; changeType: 'M' | 'A' | 'D' }>();

  for (const sha of commitShas) {
    try {
      const entries = await gitEngine.getCommitDiff(repoId, sha);
      for (const entry of entries) {
        const existing = blobMap.get(entry.filepath);
        if (!existing) {
          blobMap.set(entry.filepath, {
            oldContent: entry.oldContent,
            newContent: entry.newContent,
            changeType: entry.changeType,
          });
        } else {
          existing.newContent = entry.newContent;
          if (existing.changeType === 'A' && entry.changeType === 'D') {
            existing.changeType = 'D';
          } else if (existing.changeType !== 'D') {
            existing.changeType = entry.changeType;
          }
        }
      }
    } catch (err) {
      console.warn('[P2P] getCommitDiff failed for', sha, err);
    }
  }

  if (blobMap.size === 0) return [];
  return Array.from(blobMap.entries()).map(([filepath, { oldContent, newContent, changeType }]) =>
    diffFileFromBlobs(filepath, oldContent, newContent, changeType)
  );
}

// ─── Session relay (AsyncStorage) ────────────────────────────────────────────

export async function storeSession(session: P2PSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_PREFIX + session.sessionToken, JSON.stringify(session));
}

export async function getSession(sessionToken: string): Promise<P2PSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_PREFIX + sessionToken);
    if (!raw) return null;
    return JSON.parse(raw) as P2PSession;
  } catch {
    return null;
  }
}

export async function updateSessionState(sessionToken: string, state: P2PSessionState): Promise<void> {
  const session = await getSession(sessionToken);
  if (session) {
    session.state = state;
    await storeSession(session);
  }
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await AsyncStorage.removeItem(SESSION_PREFIX + sessionToken);
}

// ─── Create sender session ────────────────────────────────────────────────────

export interface CreateSessionResult {
  session: P2PSession;
  qrPayload: QRPayload;
  qrString: string;
  deviceIp: string;
}

export async function createSenderSession(
  repoId: string,
  repoName: string,
  senderName: string,
  selectedCommitShas: string[],
  githubToken?: string | null,
): Promise<CreateSessionResult> {
  const token = generateSessionToken();
  const deviceIp = await getDeviceIP();

  // Build real diff files — tries GitHub API first, falls back to local blobs
  const diffFiles = await buildRealDiffFiles(repoId, selectedCommitShas, githubToken);

  const session: P2PSession = {
    sessionToken: token,
    repoId,
    repoName,
    senderName,
    commits: selectedCommitShas,
    diffFiles,
    state: 'pending',
    createdAt: Date.now(),
  };

  await storeSession(session);

  // Resolve GitHub owner/repo to embed in QR so receiver can fetch diffs
  const remoteUrl = await gitEngine.getRemoteUrl(repoId).catch(() => null);
  const ghInfo = remoteUrl ? parseGitHubRemoteUrl(remoteUrl) : null;

  const qrPayload = buildQRPayload(
    repoId, repoName, selectedCommitShas, deviceIp, token, senderName,
    ghInfo?.owner, ghInfo?.repo,
  );
  const qrString = encodeQRPayload(qrPayload);

  return { session, qrPayload, qrString, deviceIp };
}
