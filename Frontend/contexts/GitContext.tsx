import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  Repository, GitCommit, GitFile, GitBranch, ConflictFile,
  AppSettings, FileStatus,
} from '@/types/git';
import {
  mockRepositories, mockCommits, mockFiles, mockConflicts,
} from '@/mocks/repositories';

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

const SETTINGS_KEY = '@gitlane_settings';
const REPOS_KEY = '@gitlane_repos';

export const [GitProvider, useGit] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [repositories, setRepositories] = useState<Repository[]>(mockRepositories);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictFile[]>(mockConflicts);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      return stored ? JSON.parse(stored) as AppSettings : defaultSettings;
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    },
    onSuccess: (data) => {
      setSettings(data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    saveSettingsMutation.mutate(updated);
  }, [settings, saveSettingsMutation]);

  const selectedRepo = useMemo(
    () => repositories.find(r => r.id === selectedRepoId) ?? null,
    [repositories, selectedRepoId],
  );

  const commits = mockCommits;
  const files = mockFiles;

  const addRepository = useCallback((repo: Repository) => {
    setRepositories(prev => [repo, ...prev]);
    showToast('success', `Repository "${repo.name}" created`);
  }, []);

  const deleteRepository = useCallback((id: string) => {
    setRepositories(prev => prev.filter(r => r.id !== id));
    if (selectedRepoId === id) setSelectedRepoId(null);
    showToast('warning', 'Repository removed');
  }, [selectedRepoId]);

  const switchBranch = useCallback((repoId: string, branchName: string) => {
    setRepositories(prev => prev.map(r => {
      if (r.id !== repoId) return r;
      return {
        ...r,
        currentBranch: branchName,
        branches: r.branches.map(b => ({ ...b, isCurrent: b.name === branchName })),
      };
    }));
    showToast('success', `Switched to ${branchName}`);
  }, []);

  const createBranch = useCallback((repoId: string, name: string) => {
    setRepositories(prev => prev.map(r => {
      if (r.id !== repoId) return r;
      const newBranch: GitBranch = {
        name,
        isRemote: false,
        isCurrent: false,
        lastCommitSha: r.branches.find(b => b.isCurrent)?.lastCommitSha ?? '',
        lastCommitMessage: 'Branch created',
      };
      return { ...r, branches: [...r.branches, newBranch] };
    }));
    showToast('success', `Branch "${name}" created`);
  }, []);

  const stageFile = useCallback((fileId: string) => {
    console.log('Staging file:', fileId);
  }, []);

  const unstageFile = useCallback((fileId: string) => {
    console.log('Unstaging file:', fileId);
  }, []);

  const commitChanges = useCallback((message: string) => {
    if (selectedRepo) {
      setRepositories(prev => prev.map(r => {
        if (r.id !== selectedRepo.id) return r;
        return { ...r, stagedCount: 0, modifiedCount: 0 };
      }));
      showToast('success', `Committed: "${message}"`);
    }
  }, [selectedRepo]);

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
    repositories,
    selectedRepo,
    selectedRepoId,
    setSelectedRepoId,
    commits,
    files,
    conflicts,
    settings,
    updateSettings,
    addRepository,
    deleteRepository,
    switchBranch,
    createBranch,
    stageFile,
    unstageFile,
    commitChanges,
    resolveConflict,
    toastMessage,
    showToast,
    isLoading: settingsQuery.isLoading,
  };
});
