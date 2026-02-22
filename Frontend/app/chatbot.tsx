import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, Keyboard, Modal, FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Send, MessageCircle, Trash2, Paperclip, X,
  CheckCheck, FileCode, ChevronRight, Folder,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import {
  handleUserMessage,
  handleFileMessage,
  readFileForChat,
  applyFileEdit,
  type ActiveFile,
} from '@/services/git/chatbot-service';
import { gitEngine } from '@/services/git/engine';
import type { GitFile } from '@/types/git';

// ── Local types ────────────────────────────────────────────────────────────────

/**
 * A node inside the hierarchical file picker.
 * Folders have isDir=true; files have isDir=false and can be attached.
 */
interface PickerNode {
  name:         string;
  isDir:        boolean;
  relativePath: string; // relative to repo root
  absolutePath: string; // absolute POSIX path
  repoId:       string;
}

type DiffSegType = 'same' | 'add' | 'remove';
type DiffSegment = { type: DiffSegType; text: string };

interface FileEditBubble {
  newContent:    string;
  oldContent:    string;
  relativePath:  string;
  /** Repo the file belongs to — used for applyFileEdit */
  repoId:        string;
  commitMessage: string;
  status:        'pending' | 'applied' | 'dismissed' | 'error';
  errorMsg?:     string;
  appliedSha?:   string;
}

interface Message {
  id:       string;
  type:     'user' | 'bot';
  text:     string;
  loading?: boolean;
  fileEdit?: FileEditBubble;
}

// ── LCS-based diff utilities ───────────────────────────────────────────────────

function buildDiff(oldText: string, newText: string): DiffSegment[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0) as number[],
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const diff: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      diff.unshift({ type: 'same', text: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', text: b[j - 1] });
      j--;
    } else {
      diff.unshift({ type: 'remove', text: a[i - 1] });
      i--;
    }
  }
  return diff;
}

function condenseDiff(diff: DiffSegment[], ctx = 2): DiffSegment[] {
  const changedIdx = diff.reduce<number[]>((acc, seg, i) => {
    if (seg.type !== 'same') acc.push(i);
    return acc;
  }, []);

  if (changedIdx.length === 0) return [{ type: 'same', text: '(no changes detected)' }];

  const shown = new Set<number>();
  for (const ci of changedIdx)
    for (let k = Math.max(0, ci - ctx); k <= Math.min(diff.length - 1, ci + ctx); k++)
      shown.add(k);

  const result: DiffSegment[] = [];
  let prev = -2;
  for (const idx of [...shown].sort((a, b) => a - b)) {
    if (prev !== -2 && idx > prev + 1) result.push({ type: 'same', text: '···' });
    result.push(diff[idx]);
    prev = idx;
  }
  return result.slice(0, 25);
}

// ── Tree navigation helpers ────────────────────────────────────────────────────

/** Traverse a nested GitFile tree to find the node array at the given path. */
function getNodesAtPath(tree: GitFile[], path: string[]): GitFile[] {
  if (path.length === 0) return tree;
  const [head, ...rest] = path;
  const dirNode = tree.find(n => n.name === head && n.isDirectory);
  if (!dirNode?.children) return [];
  return getNodesAtPath(dirNode.children, rest);
}

/** Convert GitFile nodes at a given path into PickerNodes. */
function makePickerNodes(
  nodes: GitFile[],
  repoId: string,
  pathStack: string[],
): PickerNode[] {
  const dir = gitEngine.resolveRepoDir(repoId);
  return nodes.map(f => {
    const relPath = pathStack.length > 0
      ? `${pathStack.join('/')}/${f.name}`
      : f.name;
    return {
      name:         f.name,
      isDir:        f.isDirectory,
      relativePath: relPath,
      absolutePath: `${dir}/${relPath}`,
      repoId,
    };
  }).sort((a, b) => {
    // Directories first, then alphabetical
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChatbotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedRepoId, repositories, settings } = useGit();

  const effectiveRepoId = selectedRepoId ?? repositories[0]?.id ?? null;

  // ── Route params for "Open in Chat" from file-viewer ──────────────────────
  const fileParams = useLocalSearchParams<{
    repoId?:   string;
    filePath?: string;
    fileName?: string;
  }>();

  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const storageKey = `gitlane:chat:${effectiveRepoId ?? 'global'}`;

  // ── File-chat state ────────────────────────────────────────────────────────
  const [activeFile, setActiveFile]   = useState<ActiveFile | null>(null);
  const [committingId, setCommittingId] = useState<string | null>(null);

  // Stash pending auto-attach info (from route params) so the history-load
  // effect can apply it after chat history is restored — not before.
  const pendingAttachRef = useRef<{ repoId: string; filePath: string } | null>(
    fileParams.repoId && fileParams.filePath
      ? { repoId: fileParams.repoId, filePath: fileParams.filePath }
      : null,
  );

  // ── Hierarchical file picker state ─────────────────────────────────────────
  const [showFilePicker, setShowFilePicker]           = useState(false);
  /** 'repos' = repo list; 'browse' = navigating inside a repo */
  const [pickerStage, setPickerStage]                 = useState<'repos' | 'browse'>('repos');
  const [pickerBrowseRepoId, setPickerBrowseRepoId]   = useState<string | null>(null);
  /** Path stack: ['src', 'components'] means we're inside src/components/ */
  const [pickerBrowsePath, setPickerBrowsePath]       = useState<string[]>([]);
  const [pickerRootTree, setPickerRootTree]           = useState<GitFile[]>([]);
  const [pickerBrowseLoading, setPickerBrowseLoading] = useState(false);

  // ── Welcome message ────────────────────────────────────────────────────────
  const makeWelcome = useCallback((): Message => {
    const repoName = repositories.find(r => r.id === effectiveRepoId)?.name;
    const repoLine = repoName
      ? `Active repo: **${repoName}**`
      : repositories.length === 0
        ? 'No repositories yet — clone or create one first.'
        : 'No repo selected — open a repo to use git queries.';
    return {
      id:   'welcome',
      type: 'bot',
      text:
        `Hey! I'm your Git assistant.\n${repoLine}\n\n` +
        'You can ask me:\n' +
        '• "Show me the latest changes"\n' +
        '• "Find commits by Alice"\n' +
        '• "Search for files named index"\n' +
        '• "Show commits from last week"\n' +
        '• Tap 📎 to attach a file and ask about it\n' +
        '• Or just say hello 🙂',
    };
  }, [effectiveRepoId, repositories]);

  // ── Load chat history ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    setActiveFile(null);

    const applyPendingAttach = () => {
      const pending = pendingAttachRef.current;
      pendingAttachRef.current = null; // only once
      if (!pending) return;
      const absPath = `${gitEngine.resolveRepoDir(pending.repoId)}/${pending.filePath}`;
      readFileForChat(absPath, pending.filePath, pending.repoId)
        .then(af => { if (!cancelled) setActiveFile(af); })
        .catch(() => {});
    };

    AsyncStorage.getItem(storageKey).then(raw => {
      if (cancelled) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Message[];
          if (saved.length > 0) {
            setMessages(saved);
            setHistoryLoaded(true);
            applyPendingAttach();
            return;
          }
        } catch { /* corrupted — fall through */ }
      }
      setMessages([makeWelcome()]);
      setHistoryLoaded(true);
      applyPendingAttach();
    }).catch(() => {
      if (!cancelled) {
        setMessages([makeWelcome()]);
        setHistoryLoaded(true);
        applyPendingAttach();
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ── Persist messages ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!historyLoaded) return;
    const real = messages.filter(m => !m.loading);
    if (real.length <= 1 && real[0]?.id === 'welcome') return;
    const toSave = real.map(m =>
      m.fileEdit?.status === 'pending'
        ? { ...m, fileEdit: { ...m.fileEdit, status: 'dismissed' as const } }
        : m,
    );
    AsyncStorage.setItem(storageKey, JSON.stringify(toSave)).catch(() => {});
  }, [messages, historyLoaded, storageKey]);

  // ── Clear chat ─────────────────────────────────────────────────────────────
  const handleClearChat = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey).catch(() => {});
    setMessages([makeWelcome()]);
    setActiveFile(null);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [storageKey, makeWelcome]);

  // ── Misc UI state ──────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0, duration: 0,   useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 2, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 3, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ).start();
  }, [dotAnim]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── File picker — open ──────────────────────────────────────────────────────
  const openFilePicker = useCallback(() => {
    if (repositories.length === 0) {
      setMessages(prev => [...prev, {
        id:   Date.now().toString(),
        type: 'bot',
        text: 'No repositories yet. Clone or create a repo first.',
      }]);
      scrollToBottom();
      return;
    }
    setPickerBrowsePath([]);
    setPickerRootTree([]);
    if (repositories.length === 1) {
      // Skip repo selection, go straight to browsing the only repo
      const onlyId = repositories[0].id;
      setPickerBrowseRepoId(onlyId);
      setPickerStage('browse');
      setShowFilePicker(true);
      setPickerBrowseLoading(true);
      gitEngine.getWorkingTree(onlyId)
        .then(tree => setPickerRootTree(tree))
        .catch(() => setPickerRootTree([]))
        .finally(() => setPickerBrowseLoading(false));
    } else {
      setPickerStage('repos');
      setPickerBrowseRepoId(null);
      setShowFilePicker(true);
    }
  }, [repositories, scrollToBottom]);

  // ── File picker — select a repo ────────────────────────────────────────────
  const selectPickerRepo = useCallback((repoId: string) => {
    setPickerBrowseRepoId(repoId);
    setPickerBrowsePath([]);
    setPickerRootTree([]);
    setPickerStage('browse');
    setPickerBrowseLoading(true);
    gitEngine.getWorkingTree(repoId)
      .then(tree => setPickerRootTree(tree))
      .catch(() => setPickerRootTree([]))
      .finally(() => setPickerBrowseLoading(false));
  }, []);

  // ── File picker — navigate into a folder ───────────────────────────────────
  const navigatePickerFolder = useCallback((folderName: string) => {
    setPickerBrowsePath(prev => [...prev, folderName]);
  }, []);

  // ── File picker — go back ──────────────────────────────────────────────────
  const pickerGoBack = useCallback(() => {
    if (pickerBrowsePath.length > 0) {
      setPickerBrowsePath((prev: string[]) => prev.slice(0, -1));
    } else if (repositories.length > 1) {
      setPickerStage('repos');
      setPickerBrowseRepoId(null);
    } else {
      setShowFilePicker(false);
    }
  }, [pickerBrowsePath.length, repositories.length]);

  // ── File picker — attach a file ────────────────────────────────────────────
  const handlePickFile = useCallback(async (node: PickerNode) => {
    setShowFilePicker(false);
    try {
      const af = await readFileForChat(node.absolutePath, node.relativePath, node.repoId);
      setActiveFile(af);
      const repoName = repositories.find(r => r.id === node.repoId)?.name ?? node.repoId;
      const lineInfo = af.truncated
        ? `, showing first 60 of ${af.lineCount} lines`
        : `, ${af.lineCount} lines`;
      setMessages(prev => [...prev, {
        id:   Date.now().toString(),
        type: 'bot',
        text:
          `📄 **${af.name}** attached.\n` +
          `Repo: ${repoName}  •  Path: ${af.relativePath}${lineInfo}\n\n` +
          'Ask me to explain it, review it, or describe a change to make.',
      }]);
      scrollToBottom();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), type: 'bot', text: `❌ ${msg}`,
      }]);
      scrollToBottom();
    }
  }, [repositories, scrollToBottom]);

  // ── Apply the AI-suggested edit and commit ─────────────────────────────────
  const handleApplyEdit = useCallback(async (
    messageId: string,
    editData: FileEditBubble,
  ) => {
    // Always use the repoId stored with the edit bubble — never the current effectiveRepoId
    const targetRepoId = editData.repoId;
    if (!targetRepoId || editData.status !== 'pending') return;
    setCommittingId(messageId);
    try {
      const author = {
        name:  settings.userConfig.name  || 'GitLane User',
        email: settings.userConfig.email || 'user@gitlane.app',
      };
      const sha = await applyFileEdit(
        targetRepoId,
        editData.relativePath,
        editData.newContent,
        editData.commitMessage,
        author,
      );
      // Keep active file in sync
      if (activeFile?.relativePath === editData.relativePath && activeFile?.repoId === targetRepoId) {
        setActiveFile(prev => prev
          ? {
              ...prev,
              content:   editData.newContent,
              lineCount: editData.newContent.split('\n').length,
              truncated: false,
            }
          : prev,
        );
      }
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, fileEdit: { ...m.fileEdit!, status: 'applied', appliedSha: sha } }
          : m,
      ));
      setMessages(prev => [...prev, {
        id:   (Date.now() + 1).toString(),
        type: 'bot',
        text: `✅ Committed!\nSHA: ${sha}\n"${editData.commitMessage}"`,
      }]);
      scrollToBottom();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, fileEdit: { ...m.fileEdit!, status: 'error', errorMsg: msg } }
          : m,
      ));
    } finally {
      setCommittingId(null);
    }
  }, [activeFile, settings, scrollToBottom]);

  const handleDismissEdit = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, fileEdit: { ...m.fileEdit!, status: 'dismissed' } }
        : m,
    ));
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userInput = inputText.trim();
    const userMsg: Message = { id: Date.now().toString(), type: 'user', text: userInput };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    Keyboard.dismiss();
    scrollToBottom();

    setIsLoading(true);
    const loadingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: loadingId, type: 'bot', text: '', loading: true }]);
    scrollToBottom();

    if (activeFile) {
      try {
        const result = await handleFileMessage(userInput, activeFile);
        if (result.action === 'EDIT' && result.newContent) {
          setMessages(prev => prev.map(m => m.id === loadingId
            ? {
                ...m,
                loading: false,
                text:    result.text,
                fileEdit: {
                  newContent:    result.newContent!,
                  oldContent:    activeFile.content,
                  relativePath:  activeFile.relativePath,
                  repoId:        activeFile.repoId,   // ← carry over the correct repo
                  commitMessage: result.commitMessage ?? `AI: ${userInput.slice(0, 72)}`,
                  status:        'pending',
                },
              }
            : m,
          ));
        } else {
          setMessages(prev => prev.map(m =>
            m.id === loadingId ? { ...m, text: result.text, loading: false } : m,
          ));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, text: `Something went wrong: ${msg}`, loading: false }
            : m,
        ));
      }
    } else {
      let botResponse: string;
      try {
        botResponse = await handleUserMessage(userInput, effectiveRepoId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        botResponse = `Something went wrong: ${msg}`;
      }
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? { ...m, text: botResponse, loading: false } : m,
      ));
    }

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(false);
    scrollToBottom();
  }, [inputText, isLoading, scrollToBottom, effectiveRepoId, activeFile]);

  // ── Loading dots animation ─────────────────────────────────────────────────
  const LoadingDots = () => {
    const o1 = dotAnim.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.4, 1,   0.4, 0.4] });
    const o2 = dotAnim.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.4, 0.4, 1,   0.4] });
    const o3 = dotAnim.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.4, 0.4, 0.4, 1  ] });
    return (
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { opacity: o1 }]} />
        <Animated.View style={[styles.dot, { opacity: o2 }]} />
        <Animated.View style={[styles.dot, { opacity: o3 }]} />
      </View>
    );
  };

  // ── File-edit bubble content ───────────────────────────────────────────────
  const FileEditContent = ({ message }: { message: Message }) => {
    const fe = message.fileEdit!;
    const isCommitting = committingId === message.id;

    if (fe.status === 'applied') {
      return (
        <View style={styles.diffStatusRow}>
          <CheckCheck size={15} color="#4ade80" />
          <Text style={styles.diffAppliedText}>Applied · SHA: {fe.appliedSha ?? '…'}</Text>
        </View>
      );
    }

    if (fe.status === 'dismissed') {
      return (
        <View style={styles.diffStatusRow}>
          <X size={13} color={Colors.textMuted} />
          <Text style={styles.diffDismissedText}>Change dismissed</Text>
        </View>
      );
    }

    if (fe.status === 'error') {
      return (
        <View>
          <Text style={styles.botMessageText}>{message.text}</Text>
          <View style={styles.diffErrorBox}>
            <Text style={styles.diffErrorText}>❌ {fe.errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => handleApplyEdit(message.id, { ...fe, status: 'pending' })}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const condensed = condenseDiff(buildDiff(fe.oldContent, fe.newContent));
    return (
      <View>
        <View style={styles.diffHeader}>
          <FileCode size={13} color={Colors.accentPrimary} />
          <Text style={styles.diffHeaderText} numberOfLines={1}>
            {fe.relativePath.split('/').pop()}
          </Text>
        </View>

        {!!message.text && (
          <Text style={styles.diffSummary}>{message.text}</Text>
        )}

        <View style={styles.diffBlock}>
          {condensed.map((seg, idx) => (
            <View
              key={idx}
              style={[
                styles.diffLine,
                seg.type === 'add'    && styles.diffLineAdd,
                seg.type === 'remove' && styles.diffLineRemove,
              ]}
            >
              <Text style={styles.diffPrefix}>
                {seg.type === 'add' ? '+' : seg.type === 'remove' ? '-' : ' '}
              </Text>
              <Text style={styles.diffLineText} numberOfLines={1}>{seg.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.diffCommitMsg} numberOfLines={2}>
          💬 {fe.commitMessage}
        </Text>

        <View style={styles.diffActions}>
          <TouchableOpacity
            style={[styles.applyBtn, isCommitting && styles.applyBtnDisabled]}
            onPress={() => handleApplyEdit(message.id, fe)}
            disabled={isCommitting}
            activeOpacity={0.7}
          >
            {isCommitting
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <>
                  <CheckCheck size={13} color="#fff" />
                  <Text style={styles.applyBtnText}>Apply & Commit</Text>
                </>
              )
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => handleDismissEdit(message.id)}
            disabled={isCommitting}
            activeOpacity={0.7}
          >
            <X size={13} color={Colors.textMuted} />
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Picker: current breadcrumb title ──────────────────────────────────────
  const pickerBreadcrumb = (() => {
    if (pickerStage === 'repos') return 'Select Repository';
    const repoName = repositories.find(r => r.id === pickerBrowseRepoId)?.name ?? pickerBrowseRepoId ?? '';
    if (pickerBrowsePath.length === 0) return repoName;
    return `${repoName} / ${pickerBrowsePath.join(' / ')}`;
  })();

  const canPickerGoBack =
    pickerBrowsePath.length > 0 ||
    (pickerStage === 'browse' && repositories.length > 1);

  // ── Picker: current items ─────────────────────────────────────────────────
  const pickerCurrentNodes: PickerNode[] = (() => {
    if (pickerStage === 'repos' || !pickerBrowseRepoId || pickerBrowseLoading) return [];
    const nodes = getNodesAtPath(pickerRootTree, pickerBrowsePath);
    return makePickerNodes(nodes, pickerBrowseRepoId, pickerBrowsePath);
  })();

  // ── Picker: render a row ───────────────────────────────────────────────────
  const renderPickerNode = ({ item }: { item: PickerNode }) => (
    <TouchableOpacity
      style={styles.pickerItem}
      onPress={() => item.isDir ? navigatePickerFolder(item.name) : handlePickFile(item)}
      activeOpacity={0.7}
    >
      {item.isDir
        ? <Folder size={16} color={Colors.accentPrimary} />
        : <FileCode size={16} color={Colors.textSecondary} />
      }
      <Text style={styles.pickerItemName} numberOfLines={1}>{item.name}</Text>
      {item.isDir && <ChevronRight size={14} color={Colors.textMuted} />}
    </TouchableOpacity>
  );

  // ── Picker: render a repo row ──────────────────────────────────────────────
  const renderRepoRow = ({ item }: { item: typeof repositories[number] }) => (
    <TouchableOpacity
      style={styles.pickerItem}
      onPress={() => selectPickerRepo(item.id)}
      activeOpacity={0.7}
    >
      <Folder size={16} color="#f59e0b" />
      <View style={styles.pickerItemText}>
        <Text style={styles.pickerItemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.pickerItemPath} numberOfLines={1}>{item.id}</Text>
      </View>
      <ChevronRight size={14} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <ArrowLeft size={22} color={Colors.accentPrimary} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <MessageCircle size={22} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.headerTitle}>Git Assistant</Text>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearChat}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.type === 'user'
                ? styles.userMessageBubble
                : styles.botMessageBubble,
              !!message.fileEdit && styles.diffBubble,
            ]}
          >
            {message.loading ? (
              <LoadingDots />
            ) : message.fileEdit ? (
              <FileEditContent message={message} />
            ) : (
              <Text
                style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userMessageText : styles.botMessageText,
                ]}
              >
                {message.text}
              </Text>
            )}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Active file pill ────────────────────────────────────────────────── */}
      {activeFile && (
        <View style={styles.filePillWrapper}>
          <View style={styles.filePill}>
            <FileCode size={13} color={Colors.accentPrimary} />
            <Text style={styles.filePillText} numberOfLines={1}>{activeFile.name}</Text>
            <TouchableOpacity
              onPress={() => setActiveFile(null)}
              hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            >
              <X size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.inputWrapper, Shadows.md]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={openFilePicker}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Paperclip
              size={18}
              color={activeFile ? Colors.accentPrimary : Colors.textMuted}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={
              activeFile
                ? `Ask about ${activeFile.name}…`
                : 'Ask me anything about Git…'
            }
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
            onFocus={scrollToBottom}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            <Send
              size={18}
              color={inputText.trim() && !isLoading ? '#FFFFFF' : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hierarchical file picker ────────────────────────────────────────── */}
      <Modal
        visible={showFilePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + Spacing.md }]}>

            {/* Header row */}
            <View style={styles.pickerHeader}>
              {canPickerGoBack ? (
                <TouchableOpacity style={styles.pickerBackBtn} onPress={pickerGoBack}>
                  <ArrowLeft size={18} color={Colors.accentPrimary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerBackBtn} />
              )}
              <Text style={styles.pickerTitle} numberOfLines={1}>{pickerBreadcrumb}</Text>
              <TouchableOpacity
                style={styles.pickerCloseBtn}
                onPress={() => setShowFilePicker(false)}
              >
                <X size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {pickerStage === 'repos' ? (
              /* Repo list */
              <FlatList
                data={repositories}
                keyExtractor={item => item.id}
                renderItem={renderRepoRow}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  <View style={styles.pickerCenter}>
                    <Text style={styles.pickerSubText}>No repositories found.</Text>
                  </View>
                }
              />
            ) : pickerBrowseLoading ? (
              <View style={styles.pickerCenter}>
                <ActivityIndicator size="large" color={Colors.accentPrimary} />
                <Text style={styles.pickerSubText}>Loading files…</Text>
              </View>
            ) : pickerCurrentNodes.length === 0 ? (
              <View style={styles.pickerCenter}>
                <Text style={styles.pickerSubText}>This folder is empty.</Text>
              </View>
            ) : (
              <FlatList
                data={pickerCurrentNodes}
                keyExtractor={item => item.relativePath}
                renderItem={renderPickerNode}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}

          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const MONO: string = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    minHeight: 60,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  logoWrap: {
    width: 32, height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '600' as const, color: Colors.textPrimary },
  backBtn: {
    width: 40, height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimaryDim,
  },
  clearBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Messages
  messagesContainer: { flex: 1 },
  messagesContent:   { padding: Spacing.md },
  messageBubble: {
    marginBottom: Spacing.md,
    maxWidth: '85%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  userMessageBubble: { alignSelf: 'flex-end', backgroundColor: Colors.accentPrimary },
  botMessageBubble:  {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  diffBubble: { maxWidth: '97%', alignSelf: 'flex-start' },
  messageText:     { fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#FFFFFF' },
  botMessageText:  { color: Colors.textPrimary },

  // Loading dots
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentPrimary },

  // ── Diff bubble ─────────────────────────────────────────────────────────────
  diffHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  diffHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  diffSummary:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  diffBlock: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginBottom: 8,
  },
  diffLine:       { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4 },
  diffLineAdd:    { backgroundColor: 'rgba(74,222,128,0.13)' },
  diffLineRemove: { backgroundColor: 'rgba(248,113,113,0.13)' },
  diffPrefix: {
    width: 14,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: MONO,
    color: Colors.textMuted,
  },
  diffLineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: MONO,
    color: Colors.textPrimary,
  },
  diffCommitMsg: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  diffActions: { flexDirection: 'row', gap: Spacing.sm },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimary,
  },
  applyBtnDisabled: { opacity: 0.55 },
  applyBtnText:     { fontSize: 13, fontWeight: '600' as const, color: '#fff' },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  dismissBtnText: { fontSize: 13, color: Colors.textMuted },

  // Diff result states
  diffStatusRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  diffAppliedText:   { fontSize: 13, color: '#4ade80', fontWeight: '600' as const },
  diffDismissedText: { fontSize: 13, color: Colors.textMuted },
  diffErrorBox:      { marginTop: 6, gap: 6 },
  diffErrorText:     { fontSize: 13, color: '#f87171', lineHeight: 18 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  retryBtnText: { fontSize: 13, color: Colors.textPrimary },

  // ── Active file pill ─────────────────────────────────────────────────────────
  filePillWrapper: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '75%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimaryDim,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  filePillText: { fontSize: 13, color: Colors.accentPrimary, flex: 1 },

  // ── Input bar ────────────────────────────────────────────────────────────────
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.bgTertiary },

  // ── File picker bottom sheet ─────────────────────────────────────────────────
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: Radius.lg ?? Radius.md,
    borderTopRightRadius: Radius.lg ?? Radius.md,
    maxHeight: '72%',
    paddingTop: Spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  pickerBackBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pickerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  pickerCloseBtn: { padding: 4 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  pickerItemText: { flex: 1 },
  pickerItemName: { fontSize: 15, fontWeight: '500' as const, color: Colors.textPrimary, flex: 1 },
  pickerItemPath: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pickerCenter: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  pickerSubText: { fontSize: 14, color: Colors.textMuted },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },
});
