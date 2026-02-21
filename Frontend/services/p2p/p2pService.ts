/**
 * P2P Transfer Service
 *
 * Architecture:
 *  - Transport is abstracted behind TransportDriver.
 *  - Default driver: AsyncStorage relay (same-device testing / demo).
 *  - To support real multi-device transfer, swap driver with one backed by
 *    react-native-tcp-socket or a WebSocket relay server — zero UI changes needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { mockCommits } from '@/mocks/repositories';
import type { GitCommit } from '@/types/git';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QRPayload {
  type: 'gitlane-transfer';
  version: '1.0';
  sessionToken: string;
  deviceIp: string;
  port: number;
  repoName: string;
  repoId: string;
  commits: string[]; // short SHAs
  senderName: string;
  timestamp: number;
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

export type P2PSessionState =
  | 'pending'      // Session created, waiting for receiver to connect
  | 'connected'    // Receiver connected, sending diff data
  | 'complete'     // Transfer done
  | 'error';       // Something went wrong

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

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_PREFIX = 'gitlane:p2p:session:';
const DEFAULT_PORT = 8765;

// ─── Session Token ────────────────────────────────────────────────────────────

export function generateSessionToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ─── Device IP ────────────────────────────────────────────────────────────────

export async function getDeviceIP(): Promise<string> {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip || '192.168.1.1';
  } catch {
    return '192.168.1.1';
  }
}

// ─── QR Payload ──────────────────────────────────────────────────────────────

export function buildQRPayload(
  repoId: string,
  repoName: string,
  commits: string[],
  deviceIp: string,
  sessionToken: string,
  senderName: string,
): QRPayload {
  return {
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

// ─── Diff Generation ──────────────────────────────────────────────────────────
// Generates realistic unified diffs from mock commit data.
// In production with real repos, replace this with isomorphic-git readBlob comparisons.

const MOCK_FILE_CONTENTS: Record<string, string[]> = {
  'src/p2p/transfer.ts': [
    "import { Socket } from 'net';",
    "import { EventEmitter } from 'events';",
    "",
    "export class P2PTransfer extends EventEmitter {",
    "  private socket: Socket;",
    "  private sessionId: string;",
    "",
    "  constructor(host: string, port: number) {",
    "    super();",
    "    this.socket = new Socket();",
    "    this.sessionId = '';",
    "  }",
    "",
    "  connect() {",
    "    this.socket.connect(8765, this.host);",
    "  }",
    "",
    "  sendDiff(diff: string) {",
    "    this.socket.write(diff);",
    "  }",
    "}",
  ],
  'src/p2p/discovery.ts': [
    "import * as Network from 'expo-network';",
    "",
    "export async function discoverPeers(): Promise<string[]> {",
    "  const ip = await Network.getIpAddressAsync();",
    "  const subnet = ip.split('.').slice(0, 3).join('.');",
    "  return [];",
    "}",
  ],
  'src/utils/packfile.ts': [
    "export function encodePackfile(objects: Buffer[]): Buffer {",
    "  const header = Buffer.from('PACK');",
    "  const version = Buffer.alloc(4);",
    "  version.writeUInt32BE(2, 0);",
    "  return Buffer.concat([header, version]);",
    "}",
  ],
};

const MOCK_FILE_CHANGES: Record<string, { added: string[]; removed: string[] }> = {
  'src/p2p/transfer.ts': {
    removed: [
      "  connect() {",
      "    this.socket.connect(8765, this.host);",
      "  }",
    ],
    added: [
      "  async connect(): Promise<void> {",
      "    return new Promise((resolve, reject) => {",
      "      this.socket.connect(DEFAULT_PORT, this.host, resolve);",
      "      this.socket.on('error', reject);",
      "    });",
      "  }",
    ],
  },
  'src/p2p/discovery.ts': {
    removed: [],
    added: [
      "export async function broadcastPresence(token: string): Promise<void> {",
      "  const ip = await Network.getIpAddressAsync();",
      "  // send UDP broadcast with token",
      "  console.log('[Discovery] broadcasting at', ip);",
      "}",
    ],
  },
  'src/utils/packfile.ts': {
    removed: [
      "  return Buffer.concat([header, version]);",
    ],
    added: [
      "  const numObjects = Buffer.alloc(4);",
      "  numObjects.writeUInt32BE(objects.length, 0);",
      "  return Buffer.concat([header, version, numObjects]);",
    ],
  },
};

function buildHunk(
  filepath: string,
  baseLines: string[],
  removed: string[],
  added: string[],
  startLine: number,
): DiffHunk {
  const lines: DiffLine[] = [];
  let oldLine = startLine;
  let newLine = startLine;

  // 2 context lines before
  const ctxBefore = baseLines.slice(Math.max(0, startLine - 3), startLine - 1);
  ctxBefore.forEach((l) => {
    lines.push({ type: 'context', content: ' ' + l, oldLineNo: oldLine, newLineNo: newLine });
    oldLine++;
    newLine++;
  });

  removed.forEach((l) => {
    lines.push({ type: 'removed', content: '-' + l, oldLineNo: oldLine });
    oldLine++;
  });

  added.forEach((l) => {
    lines.push({ type: 'added', content: '+' + l, newLineNo: newLine });
    newLine++;
  });

  // 2 context lines after
  const ctxAfter = baseLines.slice(startLine + removed.length - 1, startLine + removed.length + 1);
  ctxAfter.forEach((l) => {
    lines.push({ type: 'context', content: ' ' + l, oldLineNo: oldLine, newLineNo: newLine });
    oldLine++;
    newLine++;
  });

  const hunkHeader = `@@ -${startLine},${removed.length + ctxBefore.length + ctxAfter.length} +${startLine},${added.length + ctxBefore.length + ctxAfter.length} @@`;
  return { header: hunkHeader, lines };
}

export function generateDiffFiles(commits: GitCommit[]): DiffFile[] {
  const filesMap = new Map<string, { additions: number; deletions: number; changeType: 'M' | 'A' | 'D' | 'R' }>();

  for (const commit of commits) {
    for (const file of (commit.files ?? [])) {
      const existing = filesMap.get(file.path);
      if (existing) {
        existing.additions += file.additions;
        existing.deletions += file.deletions;
      } else {
        filesMap.set(file.path, {
          additions: file.additions,
          deletions: file.deletions,
          changeType: file.changeType as 'M' | 'A' | 'D' | 'R',
        });
      }
    }
  }

  const result: DiffFile[] = [];

  for (const [filepath, stats] of filesMap.entries()) {
    const baseLines = MOCK_FILE_CONTENTS[filepath] ?? generateGenericLines(filepath, 15);
    const change = MOCK_FILE_CHANGES[filepath] ?? {
      removed: baseLines.slice(4, 6),
      added: [`  // updated: ${new Date().toISOString()}`, ...baseLines.slice(4, 6).map(l => l + ' // modified')],
    };

    const hunks: DiffHunk[] = [];

    if (stats.changeType === 'A') {
      // New file — all lines are additions
      const addedLines: DiffLine[] = baseLines.map((l, i) => ({
        type: 'added',
        content: '+' + l,
        newLineNo: i + 1,
      }));
      hunks.push({
        header: `@@ -0,0 +1,${baseLines.length} @@`,
        lines: addedLines,
      });
    } else if (stats.changeType === 'D') {
      const removedLines: DiffLine[] = baseLines.map((l, i) => ({
        type: 'removed',
        content: '-' + l,
        oldLineNo: i + 1,
      }));
      hunks.push({
        header: `@@ -1,${baseLines.length} +0,0 @@`,
        lines: removedLines,
      });
    } else {
      hunks.push(buildHunk(filepath, baseLines, change.removed, change.added, 13));
    }

    result.push({
      filepath,
      changeType: stats.changeType,
      additions: stats.additions,
      deletions: stats.deletions,
      hunks,
    });
  }

  // Add a generic file if no files found (happens with commits without `files`)
  if (result.length === 0) {
    result.push(...generateGenericDiffFiles(commits));
  }

  return result;
}

function generateGenericLines(filepath: string, count: number): string[] {
  const ext = filepath.split('.').pop() ?? 'ts';
  const lines: string[] = [
    `// ${filepath}`,
    `// Auto-generated file`,
    '',
    'export default function main() {',
  ];
  for (let i = 0; i < count - 5; i++) {
    lines.push(`  // line ${i + 1}`);
  }
  lines.push('}');
  return lines;
}

function generateGenericDiffFiles(commits: GitCommit[]): DiffFile[] {
  const topCommit = commits[0];
  const lines: DiffLine[] = [
    { type: 'context', content: ' import { Transfer } from "./p2p";', oldLineNo: 1, newLineNo: 1 },
    { type: 'context', content: ' ', oldLineNo: 2, newLineNo: 2 },
    { type: 'removed', content: `-// Previous: ${topCommit?.shortSha ?? 'HEAD~1'}`, oldLineNo: 3 },
    { type: 'added', content: `+// Updated: ${topCommit?.shortSha ?? 'HEAD'}`, newLineNo: 3 },
    { type: 'added', content: `+// ${topCommit?.message ?? 'changes applied'}`, newLineNo: 4 },
    { type: 'context', content: ' ', oldLineNo: 4, newLineNo: 5 },
  ];
  return [{
    filepath: 'src/index.ts',
    changeType: 'M',
    additions: 2,
    deletions: 1,
    hunks: [{ header: '@@ -1,4 +1,5 @@', lines }],
  }];
}

// ─── Session Storage (AsyncStorage relay — replace with TCP for real P2P) ────

export async function storeSession(session: P2PSession): Promise<void> {
  const key = SESSION_PREFIX + session.sessionToken;
  await AsyncStorage.setItem(key, JSON.stringify(session));
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

export async function updateSessionState(
  sessionToken: string,
  state: P2PSessionState,
): Promise<void> {
  const session = await getSession(sessionToken);
  if (session) {
    session.state = state;
    await storeSession(session);
  }
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await AsyncStorage.removeItem(SESSION_PREFIX + sessionToken);
}

// ─── Full flow helpers ────────────────────────────────────────────────────────

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
): Promise<CreateSessionResult> {
  const token = generateSessionToken();
  const deviceIp = await getDeviceIP();

  // Get commits that match the selected SHAs (or use all mock commits)
  const selectedCommits = selectedCommitShas.length > 0
    ? mockCommits.filter(c => selectedCommitShas.includes(c.shortSha) || selectedCommitShas.includes(c.sha))
    : mockCommits.slice(0, 3);

  const diffFiles = generateDiffFiles(selectedCommits);

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

  const qrPayload = buildQRPayload(repoId, repoName, selectedCommitShas, deviceIp, token, senderName);
  const qrString = encodeQRPayload(qrPayload);

  return { session, qrPayload, qrString, deviceIp };
}
