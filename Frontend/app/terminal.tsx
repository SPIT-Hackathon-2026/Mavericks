import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { Spacing, Radius } from "@/constants/theme";
import { useGit } from "@/contexts/GitContext";

function extFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  const parts = base.split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
}

export default function Terminal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    selectedRepo,
    files,
    commits,
    stageFile,
    unstageFile,
    commitChanges,
    createBranch,
    switchBranch,
    mergeInto,
    showToast,
    pushSelectedRepo,
  } = useGit();

  const [history, setHistory] = useState<string[]>([
    "Type 'help' to see available commands",
  ]);
  const [cmd, setCmd] = useState("");

  const append = useCallback((line: string) => {
    setHistory((h) => [...h, line]);
  }, []);

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
          files.forEach(function walk(f) {
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
        case "open": {
          const p = args[0];
          if (!p) { append("Usage: open <path>"); break; }
          const rel = p.replace(/^\//, "");
          // locate file content
          let found: { name: string; path: string; content: string | undefined } | null = null;
          const walk = (items: any[]) => {
            for (const f of items) {
              if (f.isDirectory && f.children) walk(f.children);
              else if (f.path === `/${rel}`) { found = { name: f.name, path: f.path, content: f.content }; break; }
            }
          };
          walk(files);
          router.push({ pathname: "/file-viewer", params: { name: found?.name ?? rel.split("/").pop(), ext: extFromPath(rel), content: found?.content ?? "", filePath: `/${rel}` } });
          append(`opened ${p}`);
          break;
        }
        default:
          append(`Command not found: ${head}`);
      }
    } catch (err: any) {
      append(`Error: ${err?.message ?? String(err)}`);
      showToast("error", err?.message ?? "Command failed");
    }
  }, [cmd, files, commits, selectedRepo, append, stageFile, unstageFile, commitChanges, createBranch, switchBranch, mergeInto, showToast, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Terminal</Text>
      </View>
      <ScrollView style={styles.output} contentContainerStyle={styles.outputContent}>
        {history.map((line, i) => (
          <Text key={i} style={styles.line}>{line}</Text>
        ))}
      </ScrollView>
      <View style={styles.promptRow}>
        <Text style={styles.promptLabel}>{selectedRepo?.name ?? "repo"} $</Text>
        <TextInput
          style={styles.input}
          value={cmd}
          onChangeText={setCmd}
          onSubmitEditing={run}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Type a command…"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity style={styles.runBtn} onPress={run} activeOpacity={0.8}>
          <Text style={styles.runText}>Run</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  title: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  output: { flex: 1, backgroundColor: Colors.codeBackground },
  outputContent: { padding: Spacing.md, gap: 4 },
  line: { fontFamily: "monospace", fontSize: 12, color: Colors.textPrimary },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgSecondary,
  },
  promptLabel: { fontFamily: "monospace", fontSize: 12, color: Colors.textMuted },
  input: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 12,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  runBtn: {
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  runText: { color: "#fff", fontWeight: "600", fontSize: 12 },
});
