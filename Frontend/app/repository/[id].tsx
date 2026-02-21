import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
  TouchableWithoutFeedback, TextInput, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, GitBranch, MoreVertical, Folder, FileCode2, FileText,
  FileJson, File, ChevronRight, Clock, Square, CheckSquare,
  Send, ChevronDown, Plus, Trash2, GitCommit,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import SegmentedControl from '@/components/SegmentedControl';
import StatusBadge from '@/components/StatusBadge';
import { getAuthorColor, getAuthorInitials } from '@/mocks/repositories';
import type { GitFile, GitCommit as GitCommitType } from '@/types/git';

const fileIconMap: Record<string, { Icon: typeof FileCode2; color: string }> = {
  tsx: { Icon: FileCode2, color: '#3B82F6' },
  ts: { Icon: FileCode2, color: '#3B82F6' },
  js: { Icon: FileCode2, color: '#EAB308' },
  jsx: { Icon: FileCode2, color: '#EAB308' },
  json: { Icon: FileJson, color: '#F97316' },
  md: { Icon: FileText, color: '#A3A3A3' },
};

function getFileIconComponent(ext?: string) {
  return fileIconMap[ext ?? ''] ?? { Icon: File, color: '#A3A3A3' };
}

function FileRow({ file, onPress }: { file: GitFile; onPress: () => void }) {
  const { Icon, color } = file.isDirectory
    ? { Icon: Folder, color: Colors.accentWarning }
    : getFileIconComponent(file.extension);

  return (
    <TouchableOpacity style={styles.fileRow} onPress={onPress} activeOpacity={0.6}>
      <Icon size={20} color={color} />
      <View style={styles.fileContent}>
        <Text style={styles.fileName}>{file.name}</Text>
        {!file.isDirectory && file.modifiedAt && (
          <Text style={styles.fileMeta}>{file.size ? `${(file.size / 1024).toFixed(1)}KB` : ''} · {file.modifiedAt}</Text>
        )}
      </View>
      {file.status === 'modified' && <View style={[styles.statusIndicator, { backgroundColor: Colors.statusModified }]} />}
      {file.status === 'untracked' && <View style={[styles.statusIndicator, { backgroundColor: Colors.statusUntracked }]} />}
      {file.isDirectory && <ChevronRight size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

function ChangeFileRow({
  file, staged, onToggle,
}: { file: GitFile; staged: boolean; onToggle: () => void }) {
  const { Icon, color } = getFileIconComponent(file.extension);

  return (
    <TouchableOpacity style={styles.changeRow} onPress={onToggle} activeOpacity={0.6}>
      {staged ? (
        <CheckSquare size={20} color={Colors.accentPrimary} />
      ) : (
        <Square size={20} color={Colors.borderDefault} />
      )}
      <Icon size={18} color={color} />
      <View style={styles.changeContent}>
        <Text style={[styles.fileName, staged && { color: Colors.accentPrimary }]}>{file.name}</Text>
        <Text style={styles.fileMeta}>{file.path}</Text>
      </View>
      {file.changeType && <StatusBadge type={file.changeType} />}
    </TouchableOpacity>
  );
}

function CommitRow({ commit, onPress }: { commit: GitCommitType; onPress: () => void }) {
  const authorColor = getAuthorColor(commit.author);
  const initials = getAuthorInitials(commit.author);

  return (
    <TouchableOpacity style={styles.commitRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.authorAvatar, { backgroundColor: authorColor }]}>
        <Text style={styles.authorInitials}>{initials}</Text>
      </View>
      <View style={styles.commitContent}>
        <Text style={styles.commitMessage} numberOfLines={1}>{commit.message}</Text>
        <Text style={styles.commitMeta}>{commit.author} · {commit.date}</Text>
        <View style={styles.commitTags}>
          {commit.branches.filter(b => b !== 'HEAD').map(branch => (
            <View key={branch} style={styles.commitBranchTag}>
              <GitBranch size={9} color={Colors.accentPrimary} />
              <Text style={styles.commitBranchText}>{branch}</Text>
            </View>
          ))}
          <Text style={styles.shaLabel}>{commit.shortSha}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function flattenFiles(files: GitFile[]): GitFile[] {
  const result: GitFile[] = [];
  for (const file of files) {
    if (file.isDirectory && file.children) {
      result.push(...flattenFiles(file.children));
    } else if (file.status) {
      result.push(file);
    }
  }
  return result;
}

export default function RepositoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    repositories, files, commits, selectedRepo, commitChanges,
    switchBranch, createBranch, stageFile, unstageFile, pushSelectedRepo,
  } = useGit();

  const repo = repositories.find(r => r.id === id);
  const [tabIndex, setTabIndex] = useState(0);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [stagedFileIds, setStagedFileIds] = useState<Set<string>>(new Set());

  const currentFiles = useMemo(() => {
    let current = files;
    for (const segment of currentPath) {
      const dir = current.find(f => f.name === segment && f.isDirectory);
      if (dir?.children) {
        current = dir.children;
      }
    }
    return [...current].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files, currentPath]);

  const changedFiles = useMemo(() => flattenFiles(files), [files]);
  const unstagedFiles = changedFiles.filter(f => !stagedFileIds.has(f.id));
  const stagedFiles = changedFiles.filter(f => stagedFileIds.has(f.id));

  useEffect(() => {
    const stagedFromStatus = new Set(changedFiles.filter(f => f.status === 'staged').map(f => f.id));
    if (stagedFromStatus.size > 0) {
      setStagedFileIds(stagedFromStatus);
    }
  }, [changedFiles]);

  const toggleStage = useCallback(async (file: GitFile) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const fileKey = file.path.replace(/^\//, '');
    const shouldStage = !stagedFileIds.has(file.id);

    if (shouldStage) {
      await stageFile(fileKey);
    } else {
      await unstageFile(fileKey);
    }

    setStagedFileIds(prev => {
      const next = new Set(prev);
      if (shouldStage) {
        next.add(file.id);
      } else {
        next.delete(file.id);
      }
      return next;
    });
  }, [stageFile, unstageFile, stagedFileIds]);

  const handleCommit = useCallback(() => {
    if (stagedFiles.length === 0 || !commitMessage.trim()) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    commitChanges(commitMessage.trim());
    setCommitMessage('');
    setStagedFileIds(new Set());
  }, [stagedFiles.length, commitMessage, commitChanges]);

  if (!repo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Repository not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{repo.name}</Text>
          <TouchableOpacity
            style={styles.branchBtn}
            onPress={() => setShowBranchSelector(!showBranchSelector)}
          >
            <GitBranch size={12} color={Colors.accentPrimary} />
            <Text style={styles.branchBtnText}>{repo.currentBranch}</Text>
            <ChevronDown size={12} color={Colors.accentPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.pushBtn}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              pushSelectedRepo();
            }}
            activeOpacity={0.7}
          >
            <Send size={16} color={Colors.accentPrimary} />
            <Text style={styles.pushText}>Push</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn}>
            <MoreVertical size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showBranchSelector && (
        <View style={styles.branchDropdown}>
          {repo.branches.map(branch => (
            <TouchableOpacity
              key={branch.name}
              style={[styles.branchItem, branch.isCurrent && styles.branchItemActive]}
              onPress={() => {
                switchBranch(repo.id, branch.name);
                setShowBranchSelector(false);
              }}
            >
              <GitBranch size={14} color={branch.isCurrent ? Colors.accentPrimary : Colors.textMuted} />
              <Text style={[styles.branchItemText, branch.isCurrent && styles.branchItemTextActive]}>
                {branch.name}
              </Text>
              {branch.isCurrent && <Text style={styles.headLabel}>HEAD</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.branchItem}>
            <Plus size={14} color={Colors.accentPrimary} />
            <Text style={[styles.branchItemText, { color: Colors.accentPrimary }]}>Create new branch</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={['Files', 'Changes', 'History', 'Terminal']}
          selectedIndex={tabIndex}
          onChange={setTabIndex}
        />
      </View>

      {tabIndex === 0 && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {currentPath.length > 0 && (
            <View style={styles.breadcrumb}>
              <TouchableOpacity onPress={() => setCurrentPath([])}>
                <Text style={styles.breadcrumbText}>Root</Text>
              </TouchableOpacity>
              {currentPath.map((segment, i) => (
                <React.Fragment key={segment}>
                  <ChevronRight size={14} color={Colors.textMuted} />
                  <TouchableOpacity onPress={() => setCurrentPath(currentPath.slice(0, i + 1))}>
                    <Text style={[
                      styles.breadcrumbText,
                      i === currentPath.length - 1 && styles.breadcrumbActive,
                    ]}>{segment}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
          {currentFiles.map(file => (
            <FileRow
              key={file.id}
              file={file}
              onPress={() => {
                if (file.isDirectory) {
                  setCurrentPath([...currentPath, file.name]);
                } else {
                  router.push({
                    pathname: '/file-viewer',
                    params: {
                      name: file.name,
                      content: file.content ?? '',
                      ext: file.extension ?? '',
                      filePath: file.path,
                    },
                  });
                }
              }}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tabIndex === 1 && (
        <View style={styles.tabContent}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {unstagedFiles.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Changes</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{unstagedFiles.length}</Text>
                  </View>
                </View>
                {unstagedFiles.map(file => (
                  <ChangeFileRow
                    key={file.id}
                    file={file}
                    staged={false}
                    onToggle={() => toggleStage(file)}
                  />
                ))}
              </>
            )}

            {stagedFiles.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { borderTopWidth: 1, borderTopColor: Colors.borderMuted, marginTop: Spacing.sm }]}>
                  <Text style={[styles.sectionTitle, { color: Colors.accentPrimary }]}>Staged for Commit</Text>
                  <View style={[styles.countBadge, { backgroundColor: Colors.accentPrimaryDim }]}>
                    <Text style={[styles.countText, { color: Colors.accentPrimary }]}>{stagedFiles.length}</Text>
                  </View>
                </View>
                {stagedFiles.map(file => (
                  <ChangeFileRow
                    key={file.id}
                    file={file}
                    staged
                    onToggle={() => toggleStage(file)}
                  />
                ))}
              </>
            )}
            <View style={{ height: 180 }} />
          </ScrollView>

          <View style={styles.commitComposer}>
            <TextInput
              style={styles.commitInput}
              placeholder="Describe your changes..."
              placeholderTextColor={Colors.textMuted}
              value={commitMessage}
              onChangeText={setCommitMessage}
              multiline
              maxLength={200}
              numberOfLines={3}
            />
            <View style={styles.commitFooter}>
              <Text style={styles.charCount}>{commitMessage.length}/200</Text>
              <TouchableOpacity
                style={[
                  styles.commitBtn,
                  (stagedFiles.length === 0 || !commitMessage.trim()) && styles.commitBtnDisabled,
                ]}
                onPress={handleCommit}
                disabled={stagedFiles.length === 0 || !commitMessage.trim()}
              >
                <Send size={16} color={stagedFiles.length > 0 && commitMessage.trim() ? '#FFFFFF' : Colors.textMuted} />
                <Text style={[
                  styles.commitBtnText,
                  (stagedFiles.length === 0 || !commitMessage.trim()) && styles.commitBtnTextDisabled,
                ]}>
                  Commit {stagedFiles.length > 0 ? `${stagedFiles.length} files` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {tabIndex === 2 && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {commits.map(commit => (
            <CommitRow
              key={commit.sha}
              commit={commit}
              onPress={() => {
                router.push({
                  pathname: '/commit-detail',
                  params: { sha: commit.sha },
                });
              }}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tabIndex === 3 && (
        <View style={styles.tabContent}>
          <View style={styles.terminalHeader}>
            <Text style={styles.terminalTitle}>Terminal</Text>
          </View>
          <TerminalPanel />
        </View>
      )}
    </View>
  );
}

function TerminalPanel() {
  const { selectedRepo, files, commits, stageFile, unstageFile, commitChanges, createBranch, switchBranch, mergeInto, showToast, pushSelectedRepo } = useGit();
  const [history, setHistory] = useState<string[]>(["Type 'help' to see available commands"]);
  const [cmd, setCmd] = useState("");

  const append = useCallback((line: string) => setHistory(h => [...h, line]), []);

  const run = useCallback(async () => {
    const input = cmd.trim();
    if (!input) return;
    append(`> ${input}`);
    setCmd("");
    const parts = input.match(/(?:\"[^\"]*\"|'[^']*'|\\.|[^\\s])+/g)?.map(s => s.replace(/^["']|["']$/g, "")) ?? [];
    const head = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    try {
      switch (head) {
        case "help":
          append("Available: status, add <path>, reset <path>, commit -m <msg>, branch <name>, checkout <branch>, merge <branch>, push, log, files, open <path>");
          break;
        case "status": {
          if (!selectedRepo) { append("No repository selected"); break; }
          const changed = files.filter(f => !f.isDirectory && (f.status === "modified" || f.status === "staged" || f.status === "untracked"));
          append(`${changed.length} changed files`);
          changed.forEach(f => append(`${f.status?.padEnd(9)} ${f.path}`));
          break;
        }
        case "files":
          files.forEach(function walk(f: any) {
            if (f.isDirectory && f.children) {
              append(`${f.path}/`);
              f.children.forEach(walk);
            } else {
              append(`${f.path}`);
            }
          });
          break;
        case "add": {
          const p = args[0];
          if (!p) { append("Usage: add <path>"); break; }
          await stageFile(p.replace(/^\//, ""));
          append(`staged ${p}`);
          showToast("success", `Staged ${p}`);
          break;
        }
        case "reset": {
          const p = args[0];
          if (!p) { append("Usage: reset <path>"); break; }
          await unstageFile(p.replace(/^\//, ""));
          append(`unstaged ${p}`);
          showToast("info", `Unstaged ${p}`);
          break;
        }
        case "commit": {
          const idx = args.findIndex(a => a === "-m");
          if (idx === -1 || !args[idx+1]) { append("Usage: commit -m <message>"); break; }
          const msg = args.slice(idx+1).join(" ");
          await commitChanges(msg);
          append(`committed: ${msg}`);
          break;
        }
        case "branch": {
          const name = args[0];
          if (!selectedRepo || !name) { append("Usage: branch <name>"); break; }
          await createBranch(selectedRepo.id, name);
          append(`branch created: ${name}`);
          break;
        }
        case "checkout": {
          const branch = args[0];
          if (!selectedRepo || !branch) { append("Usage: checkout <branch>"); break; }
          await switchBranch(selectedRepo.id, branch);
          append(`switched to: ${branch}`);
          break;
        }
        case "merge": {
          const branch = args[0];
          if (!selectedRepo || !branch) { append("Usage: merge <branch>"); break; }
          await mergeInto(selectedRepo.id, branch);
          append(`merged branch: ${branch}`);
          break;
        }
        case "push": {
          await pushSelectedRepo();
          append("pushed to origin");
          break;
        }
        case "log":
          commits.forEach(c => append(`${c.shortSha} ${c.date} ${c.message}`));
          break;
        default:
          append(`Command not found: ${head}`);
      }
    } catch (err: any) {
      append(`Error: ${err?.message ?? String(err)}`);
      showToast("error", err?.message ?? "Command failed");
    }
  }, [cmd, files, commits, selectedRepo, append, stageFile, unstageFile, commitChanges, createBranch, switchBranch, mergeInto, showToast, pushSelectedRepo]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.terminalOutput} contentContainerStyle={styles.terminalOutputContent}>
        {history.map((line, i) => (
          <Text key={i} style={styles.terminalLine}>{line}</Text>
        ))}
      </ScrollView>
      <View style={styles.terminalPromptRow}>
        <Text style={styles.terminalPromptLabel}>{selectedRepo?.name ?? "repo"} $</Text>
        <TextInput
          style={styles.terminalInput}
          value={cmd}
          onChangeText={setCmd}
          onSubmitEditing={run}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Type a command…"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity style={styles.terminalRunBtn} onPress={run} activeOpacity={0.8}>
          <Text style={styles.terminalRunText}>Run</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  branchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  branchBtnText: {
    fontSize: 12,
    color: Colors.accentPrimary,
    fontWeight: '500' as const,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
  },
  pushText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  branchDropdown: {
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
    paddingVertical: Spacing.xs,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  branchItemActive: {
    backgroundColor: Colors.accentPrimaryDim,
  },
  branchItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  branchItemTextActive: {
    color: Colors.accentPrimary,
    fontWeight: '600' as const,
  },
  headLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  segmentWrap: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
  },
  tabContent: {
    flex: 1,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  breadcrumbText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  breadcrumbActive: {
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  fileContent: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  fileMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  changeContent: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  commitComposer: {
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    padding: Spacing.md,
  },
  commitInput: {
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    padding: Spacing.sm + 2,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 60,
    maxHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  commitFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  commitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  commitBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
  commitBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  commitBtnTextDisabled: {
    color: Colors.textMuted,
  },
  commitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  authorInitials: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  commitContent: {
    flex: 1,
  },
  commitMessage: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  commitMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  commitTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  commitBranchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  commitBranchText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  shaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  terminalHeader: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  terminalTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
  terminalOutput: { flex: 1, backgroundColor: Colors.codeBackground },
  terminalOutputContent: { padding: Spacing.md, gap: 4 },
  terminalLine: { fontFamily: 'monospace', fontSize: 12, color: Colors.textPrimary },
  terminalPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgSecondary,
  },
  terminalPromptLabel: { fontFamily: 'monospace', fontSize: 12, color: Colors.textMuted },
  terminalInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  terminalRunBtn: {
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  terminalRunText: { color: '#fff', fontWeight: '600' as const, fontSize: 12 },
});
