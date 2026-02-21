import { mockConflicts } from "@/mocks/repositories";
import { gitEngine } from "@/services/git/engine";
import { listUserRepos } from "@/services/github/api";
import { storage } from "@/services/storage/storage";
import { profileCache } from "@/services/storage/profileCache";
import { pushQueue } from "@/services/sync/pushQueue";
import { AppSettings, ConflictFile, GitHubRepo } from "@/types/git";
import createContextHook from "@nkzw/create-context-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TAG = "[GitContext]";

const defaultSettings: AppSettings = {
  userConfig: { name: "Rachit Chheda", email: "rachit.chheda24@spit.ac.in" },
  notifications: {
    commitSuccess: true,
    commitFailed: true,
    mergeConflicts: true,
    backgroundTasks: false,
    p2pTransfers: true,
  },
  accentColor: "green",
  codeFontSize: 13,
  p2pMethod: "wifi-direct",
  autoAcceptKnown: true,
  discoveryVisible: true,
  enableReflog: true,
  githubToken: null,
  githubClientId: null,
};

const SETTINGS_KEY = "gitlane:settings";

export const [GitProvider, useGit] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictFile[]>(mockConflicts);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<{
    phase: string;
    loaded: number;
    total: number;
  } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => storage.getSettings<AppSettings>(defaultSettings),
  });

  const settings = settingsQuery.data ?? defaultSettings;

  const repositoriesQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: () => gitEngine.listRepositories(),
  });

  const githubReposQuery = useQuery({
    queryKey: ["githubRepos", settings.githubToken],
    queryFn: async () => {
      if (!settings.githubToken) return [] as GitHubRepo[];
      return listUserRepos(settings.githubToken);
    },
    enabled: !!settings.githubToken,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await storage.setSettings(newSettings);
      return newSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      const updated = { ...settings, ...partial };
      saveSettingsMutation.mutate(updated);
    },
    [settings, saveSettingsMutation],
  );

  const selectedRepo = useMemo(
    () => repositoriesQuery.data?.find((r) => r.id === selectedRepoId) ?? null,
    [repositoriesQuery.data, selectedRepoId],
  );

  useEffect(() => {
    if (
      !selectedRepoId &&
      repositoriesQuery.data &&
      repositoriesQuery.data.length > 0
    ) {
      setSelectedRepoId(repositoriesQuery.data[0].id);
    }
  }, [repositoriesQuery.data, selectedRepoId]);

  const filesQuery = useQuery({
    queryKey: ["files", selectedRepoId],
    queryFn: () =>
      selectedRepoId ? gitEngine.getWorkingTree(selectedRepoId) : [],
    enabled: !!selectedRepoId,
  });

  const commitsQuery = useQuery({
    queryKey: ["commits", selectedRepoId],
    queryFn: async () => {
      if (!selectedRepoId || !selectedRepo) return [];
      const cached = await storage.readCache(selectedRepo.path, "commits");
      if (cached) return cached;
      const commits = await gitEngine.getCommits(selectedRepoId);
      await storage.writeCache(selectedRepo.path, "commits", commits);
      return commits;
    },
    enabled: !!selectedRepoId,
  });

  const addRepositoryMutation = useMutation({
    mutationFn: async ({
      name,
      addReadme,
    }: {
      name: string;
      addReadme?: boolean;
    }) => gitEngine.createRepository(name, addReadme ?? true),
    onSuccess: (repo) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      showToast("success", `Repository "${repo.name}" created`);
      setSelectedRepoId(repo.id);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to create repository";
      showToast("error", message);
    },
  });

  const addRepository = useCallback(
    (input: { name: string; addReadme?: boolean }) => {
      return addRepositoryMutation.mutateAsync(input);
    },
    [addRepositoryMutation],
  );

  const deleteRepository = useCallback(
    async (id: string) => {
      try {
        await gitEngine.deleteRepository(id);
        if (selectedRepoId === id) setSelectedRepoId(null);
        await queryClient.invalidateQueries({ queryKey: ["repositories"] });
        showToast("warning", "Repository removed");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete repository";
        showToast("error", message);
      }
    },
    [selectedRepoId, queryClient],
  );

  const switchBranch = useCallback(
    async (repoId: string, branchName: string) => {
      await gitEngine.switchBranch(repoId, branchName);
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["files", repoId] });
      queryClient.invalidateQueries({ queryKey: ["commits", repoId] });
      showToast("success", `Switched to ${branchName}`);
    },
    [queryClient],
  );

  const createBranch = useCallback(
    async (repoId: string, name: string) => {
      await gitEngine.createBranch(repoId, name);
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      showToast("success", `Branch "${name}" created`);
    },
    [queryClient],
  );

  const stageFile = useCallback(
    async (fileId: string) => {
      if (!selectedRepoId) return;
      await gitEngine.stageFile(selectedRepoId, fileId);
      queryClient.invalidateQueries({ queryKey: ["files", selectedRepoId] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
    [selectedRepoId, queryClient],
  );

  const unstageFile = useCallback(
    async (fileId: string) => {
      if (!selectedRepoId) return;
      await gitEngine.unstageFile(selectedRepoId, fileId);
      queryClient.invalidateQueries({ queryKey: ["files", selectedRepoId] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
    [selectedRepoId, queryClient],
  );

  const commitChanges = useCallback(
    async (message: string) => {
      if (!selectedRepo) return;
      const author = {
        name: settings.userConfig.name,
        email: settings.userConfig.email,
      };
      console.log(TAG, `commitChanges("${message}") in ${selectedRepo.id}`);
      await gitEngine.commit(selectedRepo.id, message, author);
      // Automatic cache invalidation
      await storage.deleteCache(selectedRepo.path);
      // Track offline commit for profile graph
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await profileCache.addOfflineCommit({
        repoName: selectedRepo.name,
        date: dateStr,
        message,
        timestamp: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["files", selectedRepo.id] });
      queryClient.invalidateQueries({ queryKey: ["commits", selectedRepo.id] });
      showToast("success", `Committed: "${message}"`);  
    },
    [
      selectedRepo,
      settings.userConfig.name,
      settings.userConfig.email,
      queryClient,
    ],
  );

  const cloneRepository = useCallback(
    async (url: string, name: string) => {
      setIsCloning(true);
      setCloneProgress({ phase: "starting", loaded: 0, total: 0 });
      console.log(TAG, `cloneRepository("${url}", "${name}")`);
      try {
        const repo = await gitEngine.cloneRepo(
          url,
          name,
          (phase, loaded, total) => setCloneProgress({ phase, loaded, total }),
          settings.githubToken ?? undefined,
        );
        queryClient.invalidateQueries({ queryKey: ["repositories"] });
        showToast("success", `Cloned "${repo.name}"`);
        setIsCloning(false);
        setCloneProgress(null);
        setSelectedRepoId(repo.id);
        return repo;
      } catch (err) {
        setIsCloning(false);
        setCloneProgress(null);
        const message = err instanceof Error ? err.message : "Clone failed";
        showToast("error", message);
        throw err;
      }
    },
    [queryClient, settings.githubToken],
  );

  const cloneGitHubRepo = useCallback(
    async (gh: GitHubRepo) => {
      const name = gh.name;
      return cloneRepository(gh.clone_url, name);
    },
    [cloneRepository],
  );

  const pushSelectedRepo = useCallback(async () => {
    if (!selectedRepo) return;
    if (!settings.githubToken) {
      showToast("warning", "GitHub token not set");
      return;
    }

    // Check connectivity first
    const online = await pushQueue.isOnline();
    if (!online) {
      // Queue the push for later
      const branch = selectedRepo.currentBranch ?? 'main';
      await pushQueue.enqueue(selectedRepo.id, selectedRepo.name, branch);
      return; // toast shown by queue subscriber
    }

    try {
      await gitEngine.push(selectedRepo.id, settings.githubToken);
      showToast("success", "Pushed to origin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Push failed";
      showToast("error", message);
    }
  }, [selectedRepo, settings.githubToken]);

  const addRemote = useCallback(
    async (repoId: string, remoteName: string, url: string) => {
      await gitEngine.addRemote(repoId, remoteName, url);
      showToast("success", `Remote "${remoteName}" set to ${url}`);
    },
    [],
  );

  const getRemotes = useCallback(
    async (repoId: string) => {
      return gitEngine.getRemotes(repoId);
    },
    [],
  );

  const mergeInto = useCallback(
    async (repoId: string, theirBranch: string) => {
      const repo = repositoriesQuery.data?.find((r) => r.id === repoId);
      if (!repo) return;
      const author = {
        name: settings.userConfig.name,
        email: settings.userConfig.email,
      };
      console.log(TAG, `mergeInto(${repoId}, ${theirBranch})`);
      try {
        await gitEngine.merge(repoId, theirBranch, author);
        await storage.deleteCache(repo.path);
        queryClient.invalidateQueries({ queryKey: ["repositories"] });
        queryClient.invalidateQueries({ queryKey: ["files", repoId] });
        queryClient.invalidateQueries({ queryKey: ["commits", repoId] });
        showToast("success", `Merged ${theirBranch}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Merge failed";
        showToast("error", message);
        throw err;
      }
    },
    [repositoriesQuery.data, settings.userConfig, queryClient],
  );

  const resolveConflict = useCallback(
    (conflictId: string, resolution: string) => {
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId
            ? { ...c, resolved: true, resultContent: resolution }
            : c,
        ),
      );
    },
    [],
  );

  const showToast = useCallback(
    (type: "success" | "error" | "warning" | "info", message: string) => {
      setToastMessage({ type, message });
      setTimeout(() => setToastMessage(null), 3000);
    },
    [],
  );

  // ── Push Queue: start monitoring + subscribe to events ─────────────
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    pushQueue.startMonitoring();

    const unsub = pushQueue.subscribe((event) => {
      switch (event.type) {
        case 'queued':
          showToastRef.current('info', event.message);
          break;
        case 'drain-start':
          showToastRef.current('info', event.message);
          break;
        case 'syncing':
          showToastRef.current('info', event.message);
          break;
        case 'success':
          showToastRef.current('success', event.message);
          queryClient.invalidateQueries({ queryKey: ['repositories'] });
          break;
        case 'failed':
          showToastRef.current('error', event.message);
          break;
        case 'drain-end':
          showToastRef.current(
            event.remaining === 0 ? 'success' : 'warning',
            event.message,
          );
          queryClient.invalidateQueries({ queryKey: ['repositories'] });
          break;
      }
    });

    return () => {
      unsub();
      pushQueue.stopMonitoring();
    };
  }, [queryClient]);

  return {
    repositories: repositoriesQuery.data ?? [],
    githubRepos: githubReposQuery.data ?? [],
    selectedRepo,
    selectedRepoId,
    setSelectedRepoId,
    commits: commitsQuery.data ?? [],
    files: filesQuery.data ?? [],
    conflicts,
    settings,
    updateSettings,
    addRepository,
    deleteRepository,
    cloneRepository,
    cloneGitHubRepo,
    pushSelectedRepo,
    addRemote,
    getRemotes,
    mergeInto,
    switchBranch,
    createBranch,
    stageFile,
    unstageFile,
    commitChanges,
    resolveConflict,
    toastMessage,
    showToast,
    isCloning,
    cloneProgress,
    isLoading:
      settingsQuery.isLoading ||
      repositoriesQuery.isLoading ||
      filesQuery.isLoading ||
      commitsQuery.isLoading ||
      githubReposQuery.isLoading,
  };
});
