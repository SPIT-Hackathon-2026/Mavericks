import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Eye,
  Edit3,
  Copy,
  Check,
  GitCommit,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode2,
  FileText,
  FileJson,
  File as FileIcon,
  X,
  Send,
  FolderOpen,
  Circle,
  MessageCircle,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Spacing, Radius, Shadows } from "@/constants/theme";
import { useGit } from "@/contexts/GitContext";
import type { GitFile } from "@/types/git";
import { expoFS } from "@/services/git/expo-fs";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TREE_PANEL_WIDTH = SCREEN_WIDTH * 0.78;

// ─── file icon helpers ───────────────────────────────────────────────────────

const fileIconMap: Record<string, { Icon: typeof FileCode2; color: string }> = {
  tsx: { Icon: FileCode2, color: "#61AFEF" },
  ts: { Icon: FileCode2, color: "#61AFEF" },
  js: { Icon: FileCode2, color: "#EAB308" },
  jsx: { Icon: FileCode2, color: "#EAB308" },
  json: { Icon: FileJson, color: "#F97316" },
  md: { Icon: FileText, color: "#A3A3A3" },
  css: { Icon: FileCode2, color: "#A855F7" },
  html: { Icon: FileCode2, color: "#EF4444" },
  py: { Icon: FileCode2, color: "#22C55E" },
  rs: { Icon: FileCode2, color: "#F97316" },
};

function getFileIcon(ext?: string) {
  return fileIconMap[ext ?? ""] ?? { Icon: FileIcon, color: "#A3A3A3" };
}

// ─── basic token coloring ────────────────────────────────────────────────────

function getLineColor(line: string): string {
  const t = line.trimStart();
  if (
    t.startsWith("//") ||
    t.startsWith("#") ||
    t.startsWith("/*") ||
    t.startsWith("*")
  )
    return "#6A9955";
  if (/^(import|export)\s/.test(t)) return "#C678DD";
  if (
    /^(const|let|var|function|return|interface|type|class|enum|async|if|else|for|while)\b/.test(
      t
    )
  )
    return "#61AFEF";
  if (/^\s*"[^"]+"\s*:/.test(line)) return "#E5C07B";
  if (t.startsWith('"') || t.startsWith("'") || t.startsWith("`"))
    return "#98C379";
  return Colors.textPrimary;
}

// ─── Directory Tree ──────────────────────────────────────────────────────────

interface TreeNodeProps {
  file: GitFile;
  depth: number;
  currentFilePath: string;
  onSelectFile: (file: GitFile) => void;
  expandedDirs: Set<string>;
  onToggleDir: (id: string) => void;
  onToggleStage: (file: GitFile) => void;
}

function TreeNode({
  file,
  depth,
  currentFilePath,
  onSelectFile,
  expandedDirs,
  onToggleDir,
  onToggleStage,
}: TreeNodeProps) {
  const isExpanded = expandedDirs.has(file.id);
  const isActive = !file.isDirectory && file.path === currentFilePath;
  const { Icon, color } = file.isDirectory
    ? { Icon: isExpanded ? FolderOpen : Folder, color: Colors.accentWarning }
    : getFileIcon(file.extension);

  const statusColor =
    file.status === "modified"
      ? Colors.statusModified
      : file.status === "staged"
      ? Colors.statusStaged
      : file.status === "untracked"
      ? Colors.accentInfo
      : null;

  return (
    <>
      <TouchableOpacity
        style={[
          treeStyles.node,
          { paddingLeft: Spacing.sm + depth * 14 },
          isActive && treeStyles.nodeActive,
        ]}
        onPress={() =>
          file.isDirectory ? onToggleDir(file.id) : onSelectFile(file)
        }
        activeOpacity={0.6}
      >
        <View style={treeStyles.dirArrow}>
          {file.isDirectory ? (
            isExpanded ? (
              <ChevronDown size={12} color={Colors.textMuted} />
            ) : (
              <ChevronRight size={12} color={Colors.textMuted} />
            )
          ) : null}
        </View>
        <Icon size={16} color={isActive ? Colors.accentPrimary : color} />
        <Text
          style={[treeStyles.nodeName, isActive && treeStyles.nodeNameActive]}
          numberOfLines={1}
        >
          {file.name}
        </Text>
        {statusColor && !file.isDirectory && (
          <TouchableOpacity
            style={treeStyles.stageBtn}
            onPress={() => onToggleStage(file)}
            activeOpacity={0.6}
          >
            <Text style={treeStyles.stageText}>
              {file.status === "staged" ? "Unstage" : "Stage"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {file.isDirectory &&
        isExpanded &&
        file.children?.map((child) => (
          <TreeNode
            key={child.id}
            file={child}
            depth={depth + 1}
            currentFilePath={currentFilePath}
            onSelectFile={onSelectFile}
            expandedDirs={expandedDirs}
            onToggleDir={onToggleDir}
            onToggleStage={onToggleStage}
          />
        ))}
    </>
  );
}

// ─── Commit Success Toast ────────────────────────────────────────────────────

function CommitSuccessToast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[toastStyles.container, { opacity }]}
      pointerEvents="none"
    >
      <Check size={15} color={Colors.accentPrimary} />
      <Text style={toastStyles.text}>Changes committed successfully</Text>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FileViewer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name: string;
    content: string;
    ext: string;
    filePath?: string;
  }>();
  const { files, selectedRepo } = useGit();

  const initialContent = params.content ?? "";

  const [fileName, setFileName] = useState(params.name ?? "Untitled");
  const [fileExt, setFileExt] = useState(params.ext ?? "");
  const [filePath, setFilePath] = useState(
    params.filePath ?? `/${params.name ?? "Untitled"}`
  );
  const [content, setContent] = useState(initialContent);
  const [editContent, setEditContent] = useState(initialContent);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [copied, setCopied] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [lintError, setLintError] = useState<string | null>(null);

  // tree drawer
  const [treeOpen, setTreeOpen] = useState(false);
  const treeX = useRef(new Animated.Value(-TREE_PANEL_WIDTH)).current;
  const overlayO = useRef(new Animated.Value(0)).current;

  function initialDirSet(list: GitFile[]): Set<string> {
    const s = new Set<string>();
    const walk = (items: GitFile[]) => {
      for (const f of items) {
        if (f.isDirectory) {
          s.add(f.id);
          if (f.children) walk(f.children);
        }
      }
    };
    walk(list);
    return s;
  }
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() =>
    initialDirSet(files)
  );

  const lines = useMemo(() => content.split("\n"), [content]);
  const pathParts = useMemo(
    () => filePath.replace(/^\//, "").split("/").filter(Boolean),
    [filePath]
  );
  const canCommit = editContent !== content && commitMsg.trim().length > 0;

  function validateJSON(text: string): string | null {
    try {
      JSON.parse(text);
      return null;
    } catch (e: any) {
      return e?.message ?? "Invalid JSON";
    }
  }
  function validateJS(text: string): string | null {
    try {
      // parse only; do not execute
      // eslint-disable-next-line no-new-func
      new Function(text);
      return null;
    } catch (e: any) {
      return e?.message ?? "Syntax error";
    }
  }
  function validateBalance(text: string): string | null {
    const s = text;
    const pairs: [string, string][] = [
      ["(", ")"],
      ["{", "}"],
      ["[", "]"],
    ];
    for (const [open, close] of pairs) {
      let count = 0;
      for (const ch of s) {
        if (ch === open) count++;
        else if (ch === close) count--;
      }
      if (count !== 0) return `Unbalanced ${open}${close}`;
    }
    return null;
  }
  React.useEffect(() => {
    if (mode !== "edit") {
      setLintError(null);
      return;
    }
    if (fileExt === "json") {
      setLintError(validateJSON(editContent));
    } else if (fileExt === "js") {
      setLintError(validateJS(editContent));
    } else if (fileExt === "ts" || fileExt === "tsx" || fileExt === "jsx") {
      setLintError(validateBalance(editContent));
    } else {
      setLintError(null);
    }
  }, [editContent, fileExt, mode]);

  // ── Tree open / close ────────────────────────────────────────────────
  const openTree = useCallback(() => {
    setTreeOpen(true);
    Animated.parallel([
      Animated.spring(treeX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }),
      Animated.timing(overlayO, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [treeX, overlayO]);

  const closeTree = useCallback(() => {
    Animated.parallel([
      Animated.spring(treeX, {
        toValue: -TREE_PANEL_WIDTH,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }),
      Animated.timing(overlayO, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setTreeOpen(false));
  }, [treeX, overlayO]);

  const toggleDir = useCallback((id: string) => {
    setExpandedDirs((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleSelectFile = useCallback(
    (file: GitFile) => {
      const c = file.content ?? "";
      setFileName(file.name);
      setFileExt(file.extension ?? "");
      setFilePath(file.path);
      setContent(c);
      setEditContent(c);
      setMode("view");
      setCommitMsg("");
      closeTree();
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [closeTree]
  );

  const { stageFile, unstageFile } = useGit();
  const toggleStage = useCallback(
    async (file: GitFile) => {
      const rel = file.path.replace(/^\//, "");
      if (file.status === "staged") {
        await unstageFile(rel);
      } else {
        await stageFile(rel);
      }
    },
    [stageFile, unstageFile]
  );

  // ── Copy ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  // ── Mode toggle ───────────────────────────────────────────────────────
  const switchMode = useCallback(
    (next: "view" | "edit") => {
      if (next === "edit") setEditContent(content);
      setMode(next);
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [content]
  );

  // ── Commit ────────────────────────────────────────────────────────────
  const { commitChanges } = useGit();
  const handleCommit = useCallback(async () => {
    if (!canCommit || !selectedRepo) return;
    const relPath = filePath.replace(/^\//, "");
    const fullPath = `${selectedRepo.path}/${relPath}`;
    try {
      await expoFS.promises.writeFile(fullPath, editContent, "utf8");
      await stageFile(relPath);
      await commitChanges(commitMsg.trim());
      setContent(editContent);
      setCommitMsg("");
      setMode("view");
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [
    canCommit,
    editContent,
    commitMsg,
    filePath,
    selectedRepo,
    stageFile,
    commitChanges,
  ]);

  const { Icon: FileIconComp, color: fileIconColor } = getFileIcon(fileExt);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={21} color={Colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.treeBtn}
          onPress={openTree}
          activeOpacity={0.7}
        >
          <FolderTree size={17} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <FileIconComp size={15} color={fileIconColor} />
          <Text style={styles.headerFileName} numberOfLines={1}>
            {fileName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          {copied ? (
            <Check size={17} color={Colors.accentPrimary} />
          ) : (
            <Copy size={17} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>

        {/* Open in AI Chat */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (!selectedRepo) return;
            const rel = filePath.replace(/^\//, '');
            router.push({
              pathname: '/chatbot',
              params: {
                repoId:   selectedRepo.id,
                filePath: rel,
                fileName: fileName,
              },
            } as any);
          }}
          activeOpacity={0.7}
        >
          <MessageCircle size={17} color={Colors.accentPrimary} />
        </TouchableOpacity>

        {/* View / Edit toggle pill */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "view" && styles.modeBtnActive]}
            onPress={() => switchMode("view")}
          >
            <Eye
              size={13}
              color={mode === "view" ? Colors.accentPrimary : Colors.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "view" && styles.modeBtnTextActive,
              ]}
            >
              View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "edit" && styles.modeBtnActive]}
            onPress={() => switchMode("edit")}
          >
            <Edit3
              size={13}
              color={mode === "edit" ? Colors.accentPrimary : Colors.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "edit" && styles.modeBtnTextActive,
              ]}
            >
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BREADCRUMB ─────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.breadcrumbBar}
        contentContainerStyle={styles.breadcrumbContent}
      >
        <Text style={styles.breadSep}>/</Text>
        {pathParts.map((part, i) => (
          <React.Fragment key={i}>
            <Text
              style={[
                styles.breadPart,
                i === pathParts.length - 1 && styles.breadPartLast,
              ]}
            >
              {part}
            </Text>
            {i < pathParts.length - 1 && (
              <ChevronRight size={11} color={Colors.textMuted} />
            )}
          </React.Fragment>
        ))}
      </ScrollView>

      {/* ── STATS BAR ──────────────────────────────────────────────── */}
      <View style={styles.statsBar}>
        <Text style={styles.statText}>{lines.length} lines</Text>
        <View style={styles.statDot} />
        <Text style={styles.statText}>{(fileExt || "txt").toUpperCase()}</Text>
        {mode === "edit" && editContent !== content && (
          <>
            <View style={styles.statDot} />
            <Text style={[styles.statText, { color: Colors.statusModified }]}>
              ● Unsaved
            </Text>
          </>
        )}
        {mode === "edit" && lintError && (
          <>
            <View style={styles.statDot} />
            <Text
              style={[styles.statText, { color: Colors.accentWarning }]}
              numberOfLines={1}
            >
              {lintError}
            </Text>
          </>
        )}
      </View>

      {/* ── CODE / EDIT AREA ───────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {mode === "view" ? (
          /* ── View mode ── */
          <ScrollView
            style={styles.codeScroll}
            showsVerticalScrollIndicator
            indicatorStyle="white"
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.codeBlock}>
                {lines.map((line, i) => (
                  <View key={i} style={styles.codeLine}>
                    <Text style={styles.lineNum}>{i + 1}</Text>
                    <View style={styles.lineGutter} />
                    <Text
                      style={[styles.codeText, { color: getLineColor(line) }]}
                    >
                      {line || " "}
                    </Text>
                  </View>
                ))}
                <View style={{ height: 80 }} />
              </View>
            </ScrollView>
          </ScrollView>
        ) : (
          /* ── Edit mode ── */
          <View style={styles.editOuter}>
            {/* line numbers column */}
            <View style={styles.editLineNums} pointerEvents="none">
              {editContent.split("\n").map((_, i) => (
                <Text key={i} style={styles.lineNum}>
                  {i + 1}
                </Text>
              ))}
            </View>
            <View style={styles.lineGutterEdit} />
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              scrollEnabled
              placeholder="Start typing..."
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        )}

        {/* ── COMMIT PANEL (edit mode) ──────────────────────────────── */}
        {mode === "edit" && (
          <View style={styles.commitPanel}>
            <View style={styles.commitDivider} />
            <View style={styles.commitRow}>
              <GitCommit size={15} color={Colors.textMuted} />
              <TextInput
                style={styles.commitInput}
                placeholder="Commit message..."
                placeholderTextColor={Colors.textMuted}
                value={commitMsg}
                onChangeText={setCommitMsg}
                returnKeyType="done"
                autoCapitalize="sentences"
                maxLength={200}
              />
            </View>
            <View style={styles.commitFooter}>
              <Text style={styles.charCount}>{commitMsg.length}/200</Text>
              <TouchableOpacity
                style={[styles.commitBtn, !canCommit && styles.commitBtnOff]}
                onPress={handleCommit}
                disabled={!canCommit}
                activeOpacity={0.8}
              >
                <Send size={13} color={canCommit ? "#fff" : Colors.textMuted} />
                <Text
                  style={[
                    styles.commitBtnText,
                    !canCommit && styles.commitBtnTextOff,
                  ]}
                >
                  Commit changes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── TREE DRAWER ────────────────────────────────────────────── */}
      {treeOpen && (
        <>
          <Animated.View
            style={[styles.overlay, { opacity: overlayO }]}
            pointerEvents="auto"
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={closeTree}
              activeOpacity={1}
            />
          </Animated.View>

          <Animated.View
            style={[styles.treePanel, { transform: [{ translateX: treeX }] }]}
          >
            {/* Tree header */}
            <View
              style={[
                styles.treeHeader,
                { paddingTop: Math.max(insets.top, Spacing.md) },
              ]}
            >
              <FolderTree size={16} color={Colors.accentPrimary} />
              <Text style={styles.treeTitle}>Explorer</Text>
              <TouchableOpacity onPress={closeTree} style={styles.iconBtn}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.repoLabelRow}>
              <Text style={styles.repoLabelText} numberOfLines={1}>
                {selectedRepo?.name ?? "Repository"}
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {files.map((file) => (
                <TreeNode
                  key={file.id}
                  file={file}
                  depth={0}
                  currentFilePath={filePath}
                  onSelectFile={handleSelectFile}
                  expandedDirs={expandedDirs}
                  onToggleDir={toggleDir}
                  onToggleStage={toggleStage}
                />
              ))}
              <View style={{ height: 60 }} />
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* ── TOAST ──────────────────────────────────────────────────── */}
      <CommitSuccessToast visible={toastVisible} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.codeBackground,
  },

  // Header
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    paddingHorizontal: 4,
    gap: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  treeBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginRight: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  headerFileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Mode toggle pill
  modeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    padding: 2,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm - 2,
  },
  modeBtnActive: {
    backgroundColor: Colors.bgElevated,
    ...Shadows.sm,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
  },
  modeBtnTextActive: {
    color: Colors.accentPrimary,
    fontWeight: "600",
  },

  // Breadcrumb
  breadcrumbBar: {
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
    maxHeight: 34,
  },
  breadcrumbContent: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    gap: 3,
  },
  breadSep: {
    fontSize: 12,
    color: Colors.textMuted,
    marginRight: 1,
    fontFamily: "monospace",
  },
  breadPart: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "monospace",
  },
  breadPartLast: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },

  // Stats bar
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
    gap: 8,
  },
  statText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "monospace",
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },

  // Code view
  codeScroll: {
    flex: 1,
    backgroundColor: Colors.codeBackground,
  },
  codeBlock: {
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  codeLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 22,
  },
  lineNum: {
    width: 42,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 12,
    lineHeight: 22,
    color: "#4C566A",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  lineGutter: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Colors.borderMuted,
    marginRight: Spacing.sm + 2,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 22,
    fontFamily: "monospace",
  },

  // Edit mode
  editOuter: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.codeBackground,
  },
  editLineNums: {
    width: 42,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.codeBackground,
    overflow: "hidden",
  },
  lineGutterEdit: {
    width: 1,
    backgroundColor: Colors.borderMuted,
    marginRight: Spacing.sm + 2,
  },
  editInput: {
    flex: 1,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontFamily: "monospace",
    paddingTop: Spacing.sm,
    paddingRight: Spacing.md,
    textAlignVertical: "top",
    backgroundColor: Colors.codeBackground,
  },

  // Commit panel
  commitPanel: {
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  commitDivider: {
    height: 1,
    backgroundColor: Colors.borderDefault,
    marginBottom: Spacing.sm,
  },
  commitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
  },
  commitInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 8,
    maxHeight: 72,
  },
  commitFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  charCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  commitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    ...Shadows.glow,
  },
  commitBtnOff: {
    backgroundColor: Colors.bgTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  commitBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  commitBtnTextOff: {
    color: Colors.textMuted,
  },

  // Overlay + tree drawer
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 10,
  },
  treePanel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: TREE_PANEL_WIDTH,
    backgroundColor: Colors.bgSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.borderDefault,
    zIndex: 20,
    ...Shadows.md,
  },
  treeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  treeTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  repoLabelRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  repoLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: 0.8,
  },
});

const treeStyles = StyleSheet.create({
  node: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingRight: Spacing.md,
    gap: 6,
  },
  nodeActive: {
    backgroundColor: Colors.accentPrimaryDim,
  },
  dirArrow: {
    width: 16,
    alignItems: "center",
  },
  nodeName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "monospace",
  },
  nodeNameActive: {
    color: Colors.accentPrimary,
    fontWeight: "600",
  },
  stageBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  stageText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});

const toastStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    ...Shadows.glow,
    zIndex: 100,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
});
