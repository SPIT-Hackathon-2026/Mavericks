import { Repository, GitBranch, GitCommit, GitFile, ConflictFile } from '@/types/git';

const makeBranch = (name: string, isCurrent: boolean, isRemote = false): GitBranch => ({
  name,
  isRemote,
  isCurrent,
  lastCommitSha: Math.random().toString(36).substring(2, 9),
  lastCommitMessage: 'Latest commit on ' + name,
  ahead: isCurrent ? 0 : Math.floor(Math.random() * 5),
  behind: isCurrent ? 0 : Math.floor(Math.random() * 3),
});

export const mockRepositories: Repository[] = [
  {
    id: '1',
    name: 'gitlane-app',
    path: '/storage/GitLane/gitlane-app',
    currentBranch: 'main',
    branches: [
      makeBranch('main', true),
      makeBranch('feature/p2p-sync', false),
      makeBranch('fix/merge-resolver', false),
      makeBranch('develop', false),
    ],
    stagedCount: 3,
    modifiedCount: 5,
    conflictCount: 0,
    lastActivity: '2 min ago',
    size: '48 MB',
    commitCount: 342,
  },
  {
    id: '2',
    name: 'react-native-git',
    path: '/storage/GitLane/react-native-git',
    currentBranch: 'develop',
    branches: [
      makeBranch('main', false),
      makeBranch('develop', true),
      makeBranch('feature/diff-view', false),
    ],
    stagedCount: 0,
    modifiedCount: 2,
    conflictCount: 0,
    lastActivity: '1 hour ago',
    size: '120 MB',
    commitCount: 1024,
  },
  {
    id: '3',
    name: 'portfolio-site',
    path: '/storage/GitLane/portfolio-site',
    currentBranch: 'main',
    branches: [
      makeBranch('main', true),
      makeBranch('redesign', false),
    ],
    stagedCount: 0,
    modifiedCount: 0,
    conflictCount: 3,
    lastActivity: '3 days ago',
    size: '12 MB',
    commitCount: 89,
  },
  {
    id: '4',
    name: 'rust-cli-tools',
    path: '/storage/GitLane/rust-cli-tools',
    currentBranch: 'main',
    branches: [makeBranch('main', true)],
    stagedCount: 1,
    modifiedCount: 0,
    conflictCount: 0,
    lastActivity: '1 week ago',
    size: '8 MB',
    commitCount: 56,
  },
];

const authorColors = ['#22C55E', '#3B82F6', '#A855F7', '#F97316', '#EF4444', '#EAB308', '#EC4899'];

export const mockCommits: GitCommit[] = [
  {
    sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    shortSha: 'a1b2c3d',
    message: 'feat: implement P2P repository transfer via Wi-Fi Direct',
    author: 'Sarah Chen',
    email: 'sarah@gitlane.dev',
    date: '2 hours ago',
    parents: ['b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1'],
    branches: ['main', 'HEAD'],
    isMerge: false,
    filesChanged: 8,
    additions: 342,
    deletions: 45,
    files: [
      { path: 'src/p2p/transfer.ts', changeType: 'M', additions: 120, deletions: 15 },
      { path: 'src/p2p/discovery.ts', changeType: 'A', additions: 89, deletions: 0 },
      { path: 'src/utils/packfile.ts', changeType: 'M', additions: 45, deletions: 12 },
    ],
  },
  {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    message: 'fix: resolve merge conflict detection in binary files',
    author: 'Alex Rivera',
    email: 'alex@gitlane.dev',
    date: '5 hours ago',
    parents: ['c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2'],
    branches: [],
    isMerge: false,
    filesChanged: 3,
    additions: 67,
    deletions: 23,
  },
  {
    sha: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    shortSha: 'c3d4e5f',
    message: 'Merge branch \'feature/diff-view\' into develop',
    author: 'Sarah Chen',
    email: 'sarah@gitlane.dev',
    date: '1 day ago',
    parents: ['d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3', 'x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0'],
    branches: ['develop'],
    isMerge: true,
    filesChanged: 12,
    additions: 456,
    deletions: 89,
  },
  {
    sha: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    shortSha: 'd4e5f6a',
    message: 'refactor: extract git object parsing into separate module',
    author: 'Jordan Park',
    email: 'jordan@gitlane.dev',
    date: '2 days ago',
    parents: ['e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'],
    branches: [],
    isMerge: false,
    filesChanged: 5,
    additions: 189,
    deletions: 134,
  },
  {
    sha: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    shortSha: 'e5f6a7b',
    message: 'feat: add syntax highlighting for 20+ languages',
    author: 'Maya son',
    email: 'maya@gitlane.dev',
    date: '3 days ago',
    parents: ['f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5'],
    branches: [],
    isMerge: false,
    filesChanged: 4,
    additions: 567,
    deletions: 12,
  },
  {
    sha: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    shortSha: 'f6a7b8c',
    message: 'chore: update dependencies and fix security vulnerabilities',
    author: 'Alex Rivera',
    email: 'alex@gitlane.dev',
    date: '4 days ago',
    parents: ['a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6'],
    branches: [],
    isMerge: false,
    filesChanged: 2,
    additions: 34,
    deletions: 28,
  },
  {
    sha: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    shortSha: 'a7b8c9d',
    message: 'feat: implement commit graph visualization with SVG',
    author: 'Sarah Chen',
    email: 'sarah@gitlane.dev',
    date: '5 days ago',
    parents: ['b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7'],
    branches: ['feature/graph'],
    isMerge: false,
    filesChanged: 6,
    additions: 423,
    deletions: 0,
  },
  {
    sha: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
    shortSha: 'b8c9d0e',
    message: 'initial commit: project scaffolding and core architecture',
    author: 'Sarah Chen',
    email: 'sarah@gitlane.dev',
    date: '1 week ago',
    parents: [],
    branches: [],
    isMerge: false,
    filesChanged: 24,
    additions: 1200,
    deletions: 0,
  },
];

export const mockFiles: GitFile[] = [
  {
    id: 'f1', name: 'src', path: '/src', isDirectory: true, children: [
      {
        id: 'f2', name: 'components', path: '/src/components', isDirectory: true, children: [
          { id: 'f3', name: 'Button.tsx', path: '/src/components/Button.tsx', isDirectory: false, size: 2400, extension: 'tsx', status: 'modified', changeType: 'M', modifiedAt: '2 hours ago', content: 'import React from \'react\';\nimport { TouchableOpacity, Text, StyleSheet } from \'react-native\';\n\ninterface ButtonProps {\n  title: string;\n  onPress: () => void;\n  variant?: \'primary\' | \'secondary\';\n}\n\nexport const Button: React.FC<ButtonProps> = ({ title, onPress, variant = \'primary\' }) => {\n  return (\n    <TouchableOpacity\n      style={[styles.button, variant === \'secondary\' && styles.secondary]}\n      onPress={onPress}\n    >\n      <Text style={styles.text}>{title}</Text>\n    </TouchableOpacity>\n  );\n};\n\nconst styles = StyleSheet.create({\n  button: {\n    backgroundColor: \'#22C55E\',\n    padding: 12,\n    borderRadius: 8,\n    alignItems: \'center\',\n  },\n  secondary: {\n    backgroundColor: \'transparent\',\n    borderWidth: 1,\n    borderColor: \'#22C55E\',\n  },\n  text: {\n    color: \'#fff\',\n    fontWeight: \'600\',\n  },\n});' },
          { id: 'f4', name: 'Header.tsx', path: '/src/components/Header.tsx', isDirectory: false, size: 1800, extension: 'tsx', status: 'staged', changeType: 'M', modifiedAt: '1 hour ago', content: 'import React from \'react\';\nimport { View, Text } from \'react-native\';\n\nexport const Header = ({ title }: { title: string }) => (\n  <View style={{ padding: 16 }}>\n    <Text style={{ fontSize: 24, fontWeight: \'bold\' }}>{title}</Text>\n  </View>\n);' },
          { id: 'f5', name: 'Card.tsx', path: '/src/components/Card.tsx', isDirectory: false, size: 3200, extension: 'tsx', modifiedAt: '3 days ago', content: '// Card component\nexport const Card = () => null;' },
        ]
      },
      {
        id: 'f6', name: 'utils', path: '/src/utils', isDirectory: true, children: [
          { id: 'f7', name: 'git.ts', path: '/src/utils/git.ts', isDirectory: false, size: 5600, extension: 'ts', status: 'modified', changeType: 'M', modifiedAt: '30 min ago', content: '// Git utility functions\nexport function parseCommit(raw: string) {\n  const lines = raw.split(\'\\n\');\n  return {\n    sha: lines[0],\n    message: lines[1],\n  };\n}' },
          { id: 'f8', name: 'packfile.ts', path: '/src/utils/packfile.ts', isDirectory: false, size: 4200, extension: 'ts', status: 'untracked', changeType: 'A', modifiedAt: '1 hour ago', content: '// Packfile parser\nexport function parsePackfile(data: Buffer) {\n  // TODO: implement\n  return null;\n}' },
        ]
      },
      { id: 'f9', name: 'App.tsx', path: '/src/App.tsx', isDirectory: false, size: 1200, extension: 'tsx', modifiedAt: '1 day ago', content: '// App entry\nimport React from \'react\';\nexport default function App() {\n  return null;\n}' },
    ]
  },
  { id: 'f10', name: 'package.json', path: '/package.json', isDirectory: false, size: 800, extension: 'json', modifiedAt: '3 days ago', content: '{\n  "name": "gitlane-app",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0",\n    "react-native": "^0.72.0"\n  }\n}' },
  { id: 'f11', name: 'README.md', path: '/README.md', isDirectory: false, size: 2400, extension: 'md', modifiedAt: '1 week ago', content: '# GitLane App\n\nA professional offline-first Git client for mobile developers.\n\n## Features\n- Local repository management\n- File browsing and editing\n- Commit history visualization\n- P2P repository transfer' },
  { id: 'f12', name: '.gitignore', path: '/.gitignore', isDirectory: false, size: 200, extension: 'gitignore', modifiedAt: '1 week ago', content: 'node_modules/\n.expo/\ndist/\n*.log' },
  { id: 'f13', name: 'tsconfig.json', path: '/tsconfig.json', isDirectory: false, size: 400, extension: 'json', modifiedAt: '1 week ago', content: '{\n  "compilerOptions": {\n    "strict": true,\n    "target": "es2020"\n  }\n}' },
];

export const mockConflicts: ConflictFile[] = [
  {
    id: 'c1',
    path: 'src/components/Button.tsx',
    name: 'Button.tsx',
    conflictCount: 2,
    resolved: false,
    oursBranch: 'main',
    theirsBranch: 'feature/redesign',
    oursContent: 'export const Button = ({ title, onPress }) => {\n  return (\n    <TouchableOpacity\n      style={styles.primaryButton}\n      onPress={onPress}\n    >\n      <Text style={styles.buttonText}>{title}</Text>\n    </TouchableOpacity>\n  );\n};',
    theirsContent: 'export const Button = ({ title, onPress, variant }) => {\n  return (\n    <Pressable\n      style={[styles.button, styles[variant]]}\n      onPress={onPress}\n    >\n      <Text style={styles.text}>{title}</Text>\n    </Pressable>\n  );\n};',
    resultContent: '',
  },
  {
    id: 'c2',
    path: 'src/utils/git.ts',
    name: 'git.ts',
    conflictCount: 1,
    resolved: false,
    oursBranch: 'main',
    theirsBranch: 'feature/redesign',
    oursContent: 'export function parseCommit(raw: string) {\n  const lines = raw.split(\'\\n\');\n  return { sha: lines[0], message: lines[1] };\n}',
    theirsContent: 'export function parseCommit(raw: string): Commit {\n  const [sha, ...rest] = raw.split(\'\\n\');\n  return { sha, message: rest.join(\'\\n\'), parsed: true };\n}',
    resultContent: '',
  },
  {
    id: 'c3',
    path: 'package.json',
    name: 'package.json',
    conflictCount: 1,
    resolved: false,
    oursBranch: 'main',
    theirsBranch: 'feature/redesign',
    oursContent: '"dependencies": {\n  "react": "^18.2.0",\n  "react-native": "^0.72.0"\n}',
    theirsContent: '"dependencies": {\n  "react": "^18.3.0",\n  "react-native": "^0.73.0",\n  "react-native-reanimated": "^3.0.0"\n}',
    resultContent: '',
  },
];

export function getAuthorColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  return authorColors[Math.abs(hash) % authorColors.length];
}

export function getAuthorInitials(author: string): string {
  return author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getFileIcon(extension?: string): { icon: string; color: string } {
  const map: Record<string, { icon: string; color: string }> = {
    ts: { icon: 'FileCode2', color: '#3B82F6' },
    tsx: { icon: 'FileCode2', color: '#3B82F6' },
    js: { icon: 'FileCode2', color: '#EAB308' },
    jsx: { icon: 'FileCode2', color: '#EAB308' },
    json: { icon: 'FileJson', color: '#F97316' },
    md: { icon: 'FileText', color: '#A3A3A3' },
    css: { icon: 'FileCode', color: '#A855F7' },
    html: { icon: 'FileCode', color: '#EF4444' },
    gitignore: { icon: 'FileX', color: '#525252' },
    py: { icon: 'FileCode2', color: '#22C55E' },
    rs: { icon: 'FileCode2', color: '#F97316' },
  };
  return map[extension ?? ''] ?? { icon: 'File', color: '#A3A3A3' };
}
