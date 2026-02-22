export type FileStatus = 'untracked' | 'modified' | 'staged' | 'conflicted' | 'deleted' | 'renamed' | 'added';

export type ChangeType = 'M' | 'A' | 'D' | 'R' | 'U';

export interface GitFile {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  status?: FileStatus;
  changeType?: ChangeType;
  children?: GitFile[];
  content?: string;
  modifiedAt?: string;
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommitSha: string;
  lastCommitMessage: string;
  ahead?: number;
  behind?: number;
}

export interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  email: string;
  date: string;
  parents: string[];
  branches: string[];
  isMerge: boolean;
  filesChanged: number;
  additions: number;
  deletions: number;
  files?: CommitFile[];
}

export interface CommitFile {
  path: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  branches: GitBranch[];
  stagedCount: number;
  modifiedCount: number;
  conflictCount: number;
  lastActivity: string;
  size: string;
  commitCount: number;
}

export interface ConflictHunk {
  id: string;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  resolved: boolean;
  resolution: 'ours' | 'theirs' | 'both' | 'manual' | null;
  resultContent: string;
}

export interface ConflictFile {
  id: string;
  path: string;
  name: string;
  conflictCount: number;
  resolved: boolean;
  oursContent: string;
  theirsContent: string;
  baseContent: string;
  resultContent: string;
  oursBranch: string;
  theirsBranch: string;
  hunks: ConflictHunk[];
}

export interface MergeState {
  inProgress: boolean;
  repoId: string;
  oursBranch: string;
  theirsBranch: string;
  conflicts: ConflictFile[];
  txId: string;
}

export interface UserConfig {
  name: string;
  email: string;
}

export interface NotificationSettings {
  commitSuccess: boolean;
  commitFailed: boolean;
  mergeConflicts: boolean;
  backgroundTasks: boolean;
  p2pTransfers: boolean;
}

export interface AppSettings {
  userConfig: UserConfig;
  notifications: NotificationSettings;
  accentColor: 'green' | 'blue' | 'purple';
  codeFontSize: number;
  p2pMethod: 'wifi-direct' | 'hotspot' | 'bluetooth';
  autoAcceptKnown: boolean;
  discoveryVisible: boolean;
  enableReflog: boolean;
  githubToken?: string | null;
  githubClientId?: string | null;
}

export interface TransferState {
  mode: 'idle' | 'waiting' | 'connecting' | 'transferring' | 'verifying' | 'complete' | 'error';
  progress: number;
  speed: string;
  eta: string;
  peerName: string;
  totalSize: string;
  transferredSize: string;
}

export type GraphNode = {
  sha: string;
  x: number;
  y: number;
  column: number;
  color: string;
  isHead: boolean;
  isMerge: boolean;
  commit: GitCommit;
};

export type GraphEdge = {
  fromSha: string;
  toSha: string;
  isMerge: boolean;
  color: string;
  path: string;
};

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  clone_url: string;
  private: boolean;
  updated_at: string;
}
