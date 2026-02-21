import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Repository, ConflictFile, AppSettings } from '@/types/git';
import { mockConflicts } from '@/mocks/repositories';
import { gitEngine } from '@/services/git/engine';
import { storage } from '@/services/storage/storage';

const TAG = '[GitContext]';

const defaultSettings: AppSettings = {
  userConfig: { name: 'John Doe', email: 'john@example.com' },
  notifications: {
    commitSuccess: true,
    commitFailed: true,
    mergeConflicts: true,
    backgroundTasks: false,
    p2pTransfers: true,
  },
  accentColor: 'green',
  codeFontSize: 13,
  p2pMethod: 'wifi-direct',
  autoAcceptKnown: true,
  discoveryVisible: true,
  enableReflog: true,
};

const SETTINGS_KEY = 'gitlane:settings';

export const [GitProvider, useGit] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictFile[]>(mockConflicts);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => storage.getSettings<AppSettings>(defaultSettings),
  });

  const settings = settingsQuery.data ?? defaultSettings;

  const repositoriesQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => gitEngine.listRepositories(),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await storage.setSettings(newSettings);
      return newSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    saveSettingsMutation.mutate(updated);
  }, [settings, saveSettingsMutation]);

  const selectedRepo = useMemo(
    () => repositoriesQuery.data?.find(r => r.id === selectedRepoId) ?? null,
    [repositoriesQuery.data, selectedRepoId],
  );

  useEffect(() => {
    if (!selectedRepoId && repositoriesQuery.data && repositoriesQuery.data.length > 0) {
      setSelectedRepoId(repositoriesQuery.data[0].id);
    }
  }, [repositoriesQuery.data, selectedRepoId]);

  const filesQuery = useQuery({
    queryKey: ['files', selectedRepoId],
    queryFn: () => selectedRepoId ? gitEngine.getWorkingTree(selectedRepoId) : [],
    enabled: !!selectedRepoId,
  });

  const commitsQuery = useQuery({
    queryKey: ['commits', selectedRepoId],
    queryFn: async () => {
      if (!selectedRepoId || !selectedRepo) return [];
      const cached = await storage.readCache(selectedRepo.path, 'commits');
      if (cached) return cached;
      const commits = await gitEngine.getCommits(selectedRepoId);
      await storage.writeCache(selectedRepo.path, 'commits', commits);
      return commits;
    },
    enabled: !!selectedRepoId,
  });

  const addRepositoryMutation = useMutation({
    mutationFn: async ({ name, addReadme }: { name: string; addReadme?: boolean }) => gitEngine.createRepository(name, addReadme ?? true),
    onSuccess: (repo) => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      showToast('success', `Repository "${repo.name}" created`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create repository';
      showToast('error', message);
    },
  });

  const addRepository = useCallback((input: { name: string; addReadme?: boolean }) => {
    return addRepositoryMutation.mutateAsync(input);
  }, [addRepositoryMutation]);

  const deleteRepository = useCallback(async (id: string) => {
    await gitEngine.deleteRepository(id);
    if (selectedRepoId === id) setSelectedRepoId(null);
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    showToast('warning', 'Repository removed');
  }, [selectedRepoId, queryClient]);

  const switchBranch = useCallback(async (repoId: string, branchName: string) => {
    await gitEngine.switchBranch(repoId, branchName);
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    queryClient.invalidateQueries({ queryKey: ['files', repoId] });
    queryClient.invalidateQueries({ queryKey: ['commits', repoId] });
    showToast('success', `Switched to ${branchName}`);
  }, [queryClient]);

  const createBranch = useCallback(async (repoId: string, name: string) => {
    await gitEngine.createBranch(repoId, name);
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    showToast('success', `Branch "${name}" created`);
  }, [queryClient]);

  const stageFile = useCallback(async (fileId: string) => {
    if (!selectedRepoId) return;
    await gitEngine.stageFile(selectedRepoId, fileId);
    queryClient.invalidateQueries({ queryKey: ['files', selectedRepoId] });
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
  }, [selectedRepoId, queryClient]);

  const unstageFile = useCallback(async (fileId: string) => {
    if (!selectedRepoId) return;
    await gitEngine.unstageFile(selectedRepoId, fileId);
    queryClient.invalidateQueries({ queryKey: ['files', selectedRepoId] });
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
  }, [selectedRepoId, queryClient]);

  const commitChanges = useCallback(async (message: string) => {
    if (!selectedRepo) return;
    const author = {
      name: settings.userConfig.name,
      email: settings.userConfig.email,
    };
    console.log(TAG, `commitChanges("${message}") in ${selectedRepo.id}`);
    await gitEngine.commit(selectedRepo.id, message, author);
    // Automatic cache invalidation
    await storage.deleteCache(selectedRepo.path);
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    queryClient.invalidateQueries({ queryKey: ['files', selectedRepo.id] });
    queryClient.invalidateQueries({ queryKey: ['commits', selectedRepo.id] });
    showToast('success', `Committed: "${message}"`);
  }, [selectedRepo, settings.userConfig.name, settings.userConfig.email, queryClient]);

  const cloneRepository = useCallback(async (url: string, name: string) => {
    setIsCloning(true);
    console.log(TAG, `cloneRepository("${url}", "${name}")`);
    try {
      const repo = await gitEngine.cloneRepo(url, name);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      showToast('success', `Cloned "${repo.name}"`);
      setIsCloning(false);
      return repo;
    } catch (err) {
      setIsCloning(false);
      const message = err instanceof Error ? err.message : 'Clone failed';
      showToast('error', message);
      throw err;
    }
  }, [queryClient]);

  const mergeInto = useCallback(async (repoId: string, theirBranch: string) => {
    const repo = repositoriesQuery.data?.find(r => r.id === repoId);
    if (!repo) return;
    const author = {
      name: settings.userConfig.name,
      email: settings.userConfig.email,
    };
    console.log(TAG, `mergeInto(${repoId}, ${theirBranch})`);
    try {
      await gitEngine.merge(repoId, theirBranch, author);
      await storage.deleteCache(repo.path);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['files', repoId] });
      queryClient.invalidateQueries({ queryKey: ['commits', repoId] });
      showToast('success', `Merged ${theirBranch}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Merge failed';
      showToast('error', message);
      throw err;
    }
  }, [repositoriesQuery.data, settings.userConfig, queryClient]);

  const resolveConflict = useCallback((conflictId: string, resolution: string) => {
    setConflicts(prev => prev.map(c =>
      c.id === conflictId ? { ...c, resolved: true, resultContent: resolution } : c
    ));
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  return {
    repositories: repositoriesQuery.data ?? [],
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
    isLoading: settingsQuery.isLoading || repositoriesQuery.isLoading || filesQuery.isLoading || commitsQuery.isLoading,
  };
});
