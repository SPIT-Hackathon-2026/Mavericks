import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GitCommit, GitBranch, GitMerge, Clock,
  Mail, MapPin, Edit3, LogOut, Code2, User,
  Wifi, WifiOff, RefreshCw, Users,
} from 'lucide-react-native';
import * as Network from 'expo-network';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import {
  fetchGitHubProfile,
  fetchContributions,
  contribYearToMap,
  fetchUserEvents,
  deriveStatsFromEvents,
  buildRecentActivity,
  type RecentActivity,
} from '@/services/github/profile';
import {
  profileCache,
  type CachedProfile,
  type CachedStats,
  type OfflineCommit,
} from '@/services/storage/profileCache';

const CELL     = 11;
const CELL_GAP = 2;
const COL_W    = CELL + CELL_GAP;
const DAY_LABEL_W = 28;

// ─── Calendar helpers ─────────────────────────────────────────────────────────

type ContribMap = Record<string, number>;

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface WeekData {
  days: { dateStr: string; count: number; month: number }[];
  monthLabel: string | null;
}

function buildWeeks(year: number, map: ContribMap): WeekData[] {
  const jan1  = new Date(year, 0, 1);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay());

  const dec31 = new Date(year, 11, 31);
  const end   = new Date(dec31);
  end.setDate(dec31.getDate() + (6 - dec31.getDay()));

  const weeks: WeekData[] = [];
  const cur = new Date(start);
  let lastMonth = -1;

  while (cur <= end) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const ds    = toDateStr(cur);
      const count = map[ds] ?? 0;
      days.push({ dateStr: ds, count, month: cur.getMonth() });
      cur.setDate(cur.getDate() + 1);
    }
    const firstOfWeekMonth = days[0].month;
    const label = (firstOfWeekMonth !== lastMonth && days[0].dateStr.startsWith(String(year)))
      ? MONTH_NAMES[firstOfWeekMonth] : null;
    if (label) lastMonth = firstOfWeekMonth;
    weeks.push({ days, monthLabel: label });
  }
  return weeks;
}

function totalContribs(map: ContribMap) {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

function cellColor(count: number) {
  if (count === 0) return '#1A1F23';
  if (count <= 2)  return 'rgba(34,197,94,0.25)';
  if (count <= 4)  return 'rgba(34,197,94,0.45)';
  if (count <= 7)  return 'rgba(34,197,94,0.70)';
  return Colors.accentPrimary;
}

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

// ─── Avatar with GitHub photo ─────────────────────────────────────────────────

function ProfileAvatar({ avatarUrl, size = 80 }: { avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#3A3F47',
        }}
      />
    );
  }
  const headR = size * 0.22;
  const bodyW = size * 0.54;
  const bodyH = size * 0.28;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#3A3F47', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <View style={{
        width: headR * 2, height: headR * 2, borderRadius: headR,
        backgroundColor: '#9AA3AF', position: 'absolute', top: size * 0.16, alignSelf: 'center',
      }} />
      <View style={{
        width: bodyW, height: bodyH + bodyW / 2,
        borderTopLeftRadius: bodyW / 2, borderTopRightRadius: bodyW / 2,
        backgroundColor: '#9AA3AF', position: 'absolute', bottom: 0, alignSelf: 'center',
      }} />
    </View>
  );
}

// ─── Contribution Heatmap ─────────────────────────────────────────────────────

function ContributionHeatmap({
  year, onYearChange, contribMap, selectedDate, onSelectDate, availableYears,
}: {
  year: number;
  onYearChange: (y: number) => void;
  contribMap: ContribMap;
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  availableYears: number[];
}) {
  const weeks = useMemo(() => buildWeeks(year, contribMap), [year, contribMap]);
  const total = useMemo(() => totalContribs(contribMap), [contribMap]);

  return (
    <View style={hm.wrapper}>
      <View style={hm.topRow}>
        <Text style={hm.totalText}>
          <Text style={hm.totalNum}>{total}</Text> contributions in {year}
        </Text>
        <View style={hm.yearPicker}>
          {availableYears.map(y => (
            <TouchableOpacity
              key={y}
              style={[hm.yearBtn, y === year && hm.yearBtnActive]}
              onPress={() => { onYearChange(y); onSelectDate(null); }}
            >
              <Text style={[hm.yearBtnText, y === year && hm.yearBtnTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={hm.gridOuter}>
        <View style={hm.dayLabels}>
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <Text key={i} style={hm.dayLabel}>{d}</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0 }}>
              {weeks.map((w, wi) => (
                <View key={wi} style={{ width: COL_W }}>
                  {w.monthLabel
                    ? <Text style={hm.monthLabel}>{w.monthLabel}</Text>
                    : <View style={{ height: 14 }} />}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              {weeks.map((w, wi) => (
                <View key={wi} style={hm.weekCol}>
                  {w.days.map((day, di) => {
                    const inYear = day.dateStr.startsWith(String(year));
                    const isSelected = day.dateStr === selectedDate;
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          hm.cell,
                          { backgroundColor: inYear ? cellColor(day.count) : '#0E1115' },
                          isSelected && hm.cellSelected,
                        ]}
                        onPress={() => {
                          if (!inYear || day.count === 0) { onSelectDate(null); return; }
                          onSelectDate(isSelected ? null : day.dateStr);
                        }}
                        activeOpacity={0.7}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={hm.legend}>
        <Text style={hm.legendLabel}>Less</Text>
        {['#1A1F23','rgba(34,197,94,0.25)','rgba(34,197,94,0.45)','rgba(34,197,94,0.70)', Colors.accentPrimary].map((c, i) => (
          <View key={i} style={[hm.legendCell, { backgroundColor: c }]} />
        ))}
        <Text style={hm.legendLabel}>More</Text>
      </View>
    </View>
  );
}

const hm = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm, flexWrap: 'wrap', gap: 6,
  },
  totalText: { fontSize: 13, color: Colors.textSecondary },
  totalNum:  { fontWeight: '700', color: Colors.textPrimary },
  yearPicker:    { flexDirection: 'row', gap: 4 },
  yearBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.borderDefault,
  },
  yearBtnActive:     { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  yearBtnText:       { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  yearBtnTextActive: { color: '#fff', fontWeight: '700' },
  gridOuter: { flexDirection: 'row' },
  dayLabels: { width: DAY_LABEL_W, marginTop: 16 },
  dayLabel:  { height: COL_W, fontSize: 9, color: Colors.textMuted, textAlignVertical: 'center' },
  monthLabel:{ height: 14, fontSize: 9, color: Colors.textMuted },
  weekCol:   { flexDirection: 'column', marginRight: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: 2, marginBottom: CELL_GAP },
  cellSelected: { borderWidth: 1.5, borderColor: Colors.accentPrimary },
  legend: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.sm, justifyContent: 'flex-end',
  },
  legendLabel: { fontSize: 10, color: Colors.textMuted },
  legendCell:  { width: 10, height: 10, borderRadius: 2 },
});

// ─── Contribution Activity ────────────────────────────────────────────────────

function ContributionActivity({
  selectedDate, activities, loading,
}: {
  selectedDate: string | null;
  activities: RecentActivity[];
  loading: boolean;
}) {
  const displayItems = selectedDate
    ? activities.filter(a => a.dateStr === selectedDate)
    : activities;

  const heading = selectedDate
    ? formatDisplayDate(selectedDate)
    : 'Contribution activity';

  return (
    <View style={{ marginHorizontal: Spacing.md, marginBottom: Spacing.md }}>
      <Text style={ca.heading}>{heading}</Text>

      {loading && displayItems.length === 0 && (
        <View style={ca.emptyBox}>
          <ActivityIndicator size="small" color={Colors.accentPrimary} />
        </View>
      )}

      {!loading && displayItems.length === 0 && (
        <View style={ca.emptyBox}>
          <Text style={ca.emptyText}>No contributions on this day.</Text>
        </View>
      )}

      {displayItems.map((item, i) => (
        <View key={i} style={ca.card}>
          <View style={ca.iconCol}>
            <View style={ca.iconCircle}>
              <GitCommit size={13} color={Colors.accentPrimary} />
            </View>
            {i < displayItems.length - 1 && <View style={ca.line} />}
          </View>
          <View style={ca.body}>
            {item.msg ? <Text style={ca.msg}>{item.msg}</Text> : null}
            <TouchableOpacity>
              <Text style={ca.repo}>{item.repo}</Text>
            </TouchableOpacity>
            <View style={ca.metaRow}>
              {item.type === 'repo' && <View style={ca.langDot} />}
              <Text style={ca.detail}>{item.detail}</Text>
              <View style={ca.bar}>
                <View style={[ca.barFill, {
                  width: `${Math.min(100, (parseInt(item.detail) || 1) * 15)}%` as any,
                }]} />
              </View>
              <Text style={ca.dateLabel}>{item.date}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const ca = StyleSheet.create({
  heading: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  emptyBox: {
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  card: {
    flexDirection: 'row', backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    marginBottom: Spacing.sm, padding: Spacing.md, gap: 10,
  },
  iconCol: { alignItems: 'center' },
  iconCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accentPrimaryDim, alignItems: 'center', justifyContent: 'center',
  },
  line: { flex: 1, width: 1, backgroundColor: Colors.borderMuted, marginTop: 4 },
  body: { flex: 1 },
  msg:  { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  repo: { fontSize: 12, color: Colors.accentInfo, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentInfo },
  detail: { fontSize: 11, color: Colors.textSecondary },
  bar: {
    flex: 1, height: 5, backgroundColor: Colors.bgTertiary, borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.accentPrimary, borderRadius: 3 },
  dateLabel: { fontSize: 11, color: Colors.textMuted },
});

// ─── Selected day banner ──────────────────────────────────────────────────────

function DayBanner({ dateStr, count, onClear }: {
  dateStr: string; count: number; onClear: () => void;
}) {
  return (
    <View style={bannerStyles.row}>
      <View style={bannerStyles.dot} />
      <Text style={bannerStyles.text}>
        <Text style={bannerStyles.count}>{count}</Text>
        {` contribution${count !== 1 ? 's' : ''} on ${formatDisplayDate(dateStr)}`}
      </Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={bannerStyles.clear}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.accentPrimaryDim, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.accentPrimary,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentPrimary },
  text: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  count: { fontWeight: '700', color: Colors.accentPrimary },
  clear: { fontSize: 12, color: Colors.textMuted },
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: Spacing.md, paddingBottom: 6, paddingTop: Spacing.sm }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: Colors.textMuted,
        textTransform: 'uppercase', letterSpacing: 0.8,
      }}>{title}</Text>
    </View>
  );
}

// ─── Network status banner ────────────────────────────────────────────────────

function OfflineBanner({ pendingCount, onSync }: { pendingCount: number; onSync: () => void }) {
  return (
    <View style={offBannerStyles.wrapper}>
      <WifiOff size={14} color={Colors.accentWarning} />
      <Text style={offBannerStyles.text}>
        Offline mode{pendingCount > 0 ? ` · ${pendingCount} pending commit${pendingCount > 1 ? 's' : ''}` : ''}
      </Text>
      {pendingCount > 0 && (
        <TouchableOpacity onPress={onSync} style={offBannerStyles.syncBtn}>
          <RefreshCw size={12} color={Colors.accentPrimary} />
          <Text style={offBannerStyles.syncText}>Sync</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const offBannerStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  text: { flex: 1, fontSize: 12, color: Colors.accentWarning, fontWeight: '500' },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.sm, backgroundColor: Colors.accentPrimaryDim,
    borderWidth: 1, borderColor: Colors.accentPrimary,
  },
  syncText: { fontSize: 11, color: Colors.accentPrimary, fontWeight: '600' },
});

// ─── Not signed in placeholder ────────────────────────────────────────────────

function NotSignedIn() {
  return (
    <View style={{
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl * 2,
    }}>
      <User size={48} color={Colors.textMuted} />
      <Text style={{
        fontSize: 18, fontWeight: '700', color: Colors.textPrimary,
        marginTop: Spacing.md, marginBottom: Spacing.sm, textAlign: 'center',
      }}>Sign in to GitHub</Text>
      <Text style={{
        fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18,
      }}>
        Connect your GitHub account in Settings to see your profile, contribution graph, and activity.
      </Text>
    </View>
  );
}

// ─── Last Sync Info ──────────────────────────────────────────────────────────

function LastSyncInfo() {
  const [lastSync, setLastSync] = useState<string>('');

  useEffect(() => {
    profileCache.getLastSyncTime().then(ts => {
      if (!ts) { setLastSync('Never synced'); return; }
      const diff = Date.now() - ts;
      if (diff < 60_000) setLastSync('Synced just now');
      else if (diff < 3600_000) setLastSync(`Synced ${Math.floor(diff / 60_000)}m ago`);
      else if (diff < 86400_000) setLastSync(`Synced ${Math.floor(diff / 3600_000)}h ago`);
      else setLastSync(`Synced ${Math.floor(diff / 86400_000)}d ago`);
    });
  }, []);

  return (
    <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
      <Text style={{ fontSize: 10, color: Colors.textMuted }}>{lastSync}</Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, showToast } = useGit();
  const token = settings.githubToken;

  // ── State ────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [year, setYear]                   = useState(currentYear);
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [isOnline, setIsOnline]           = useState(true);
  const [isLoading, setIsLoading]         = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [isSyncing, setIsSyncing]         = useState(false);

  // Data state
  const [profile, setProfile]             = useState<CachedProfile | null>(null);
  const [contribMaps, setContribMaps]     = useState<Record<number, ContribMap>>({});
  const [stats, setStats]                 = useState<CachedStats | null>(null);
  const [activities, setActivities]       = useState<RecentActivity[]>([]);
  const [offlineCommits, setOfflineCommits] = useState<OfflineCommit[]>([]);

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear; y++) years.push(y);
    return years;
  }, [currentYear]);

  // ── Network monitoring ──────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOnline(!!state.isConnected && !!state.isInternetReachable);
      } catch {
        setIsOnline(false);
      }
    };
    check();
    interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-sync when coming back online ───────────────────
  const prevOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !prevOnline.current && token) {
      syncData();
    }
    prevOnline.current = isOnline;
  }, [isOnline, token]);

  // ── Load cached data on mount ───────────────────────────
  useEffect(() => {
    loadCachedData();
  }, []);

  // ── Fetch fresh data when token is available & online ───
  useEffect(() => {
    if (token && isOnline) {
      fetchAllData(false);
    }
  }, [token, isOnline]);

  // ── Fetch contributions when year changes ───────────────
  useEffect(() => {
    if (token && isOnline && !contribMaps[year]) {
      fetchContributionsForYear(year);
    }
  }, [year, token, isOnline]);

  // ── Load cached data ───────────────────────────────────
  const loadCachedData = useCallback(async () => {
    try {
      const [cachedProfile, cachedStats, cachedActivity, cachedOffline] = await Promise.all([
        profileCache.getProfile(),
        profileCache.getStats(),
        profileCache.getActivity(),
        profileCache.getOfflineCommits(),
      ]);

      if (cachedProfile) setProfile(cachedProfile);
      if (cachedStats) setStats(cachedStats);
      if (cachedActivity) setActivities(cachedActivity.items);
      setOfflineCommits(cachedOffline);

      const contribs: Record<number, ContribMap> = {};
      for (const y of [currentYear - 2, currentYear - 1, currentYear]) {
        const cached = await profileCache.getContributions(y);
        if (cached) contribs[y] = cached.contribMap;
      }
      if (Object.keys(contribs).length > 0) {
        setContribMaps(prev => ({ ...prev, ...contribs }));
      }
    } catch (err) {
      console.warn('[Profile] Failed to load cache:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentYear]);

  // ── Fetch all data from GitHub ─────────────────────────
  const fetchAllData = useCallback(async (showRefresh: boolean) => {
    if (!token) return;
    if (showRefresh) setIsRefreshing(true);
    try {
      const ghProfile = await fetchGitHubProfile(token);
      const cachedProfile: CachedProfile = { ...ghProfile };
      setProfile(cachedProfile);
      await profileCache.setProfile(cachedProfile);

      await fetchContributionsForYear(year);

      const events = await fetchUserEvents(token, ghProfile.login, 3);
      const derivedStats = deriveStatsFromEvents(events);
      const cachedStats: CachedStats = { ...derivedStats, fetchedAt: Date.now() };
      cachedStats.totalRepos = ghProfile.publicRepos + ghProfile.totalPrivateRepos;
      setStats(cachedStats);
      await profileCache.setStats(cachedStats);

      const recentActivity = buildRecentActivity(events, 20);
      setActivities(recentActivity);
      await profileCache.setActivity({ items: recentActivity, fetchedAt: Date.now() });

      await profileCache.setLastSyncTime();
    } catch (err) {
      console.warn('[Profile] Fetch error:', err);
      if (!profile) {
        showToast('error', 'Failed to load profile data');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [token, year, profile]);

  // ── Fetch contributions for a specific year ────────────
  const fetchContributionsForYear = useCallback(async (y: number) => {
    if (!token) return;
    try {
      const contribData = await fetchContributions(token, y);
      const map = contribYearToMap(contribData);
      setContribMaps(prev => ({ ...prev, [y]: map }));
      await profileCache.setContributions(y, {
        year: y,
        totalContributions: contribData.totalContributions,
        contribMap: map,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`[Profile] Failed to fetch contributions for ${y}:`, err);
    }
  }, [token]);

  // ── Sync offline data ──────────────────────────────────
  const syncData = useCallback(async () => {
    if (!token || !isOnline) return;
    setIsSyncing(true);
    try {
      await fetchAllData(false);
      await profileCache.markAllSynced();
      await profileCache.clearSyncedCommits();
      setOfflineCommits([]);
      showToast('success', 'Profile synced with GitHub');
    } catch (err) {
      console.warn('[Profile] Sync error:', err);
      showToast('error', 'Sync failed. Will retry when online.');
    } finally {
      setIsSyncing(false);
    }
  }, [token, isOnline, fetchAllData]);

  // ── Current contribMap (merged with offline commits) ───
  const currentContribMap = useMemo(() => {
    const base = contribMaps[year] ?? {};
    const unsyncedCommits = offlineCommits.filter(c => !c.synced);
    if (unsyncedCommits.length === 0) return base;
    return profileCache.mergeOfflineCommits(base, unsyncedCommits);
  }, [contribMaps, year, offlineCommits]);

  const selectedCount = selectedDate ? (currentContribMap[selectedDate] ?? 0) : 0;
  const pendingOffline = offlineCommits.filter(c => !c.synced).length;

  // ── Computed stats (merged with offline) ───────────────
  const displayStats = useMemo(() => {
    const base = stats ?? { totalCommits: 0, totalRepos: 0, totalBranches: 0, totalMerges: 0 };
    return [
      { label: 'Commits',  value: formatNum(base.totalCommits + pendingOffline), Icon: GitCommit, color: Colors.accentPrimary },
      { label: 'Repos',    value: String(base.totalRepos),                       Icon: Code2,     color: Colors.accentInfo },
      { label: 'Branches', value: String(base.totalBranches),                    Icon: GitBranch, color: Colors.accentPurple },
      { label: 'Merges',   value: String(base.totalMerges),                      Icon: GitMerge,  color: Colors.accentWarning },
    ];
  }, [stats, pendingOffline]);

  const joinedDate = useMemo(() => {
    if (!profile?.createdAt) return '';
    const d = new Date(profile.createdAt);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [profile]);

  // ── Not signed in ──────────────────────────────────────
  if (!token) {
    return (
      <ScrollView style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <NotSignedIn />
      </ScrollView>
    );
  }

  // ── Loading state ──────────────────────────────────────
  if (isLoading && !profile) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentPrimary} />
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.md, fontSize: 13 }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchAllData(true)}
          tintColor={Colors.accentPrimary}
          colors={[Colors.accentPrimary]}
        />
      }
    >
      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isOnline ? (
            <View style={styles.onlineBadge}>
              <Wifi size={12} color={Colors.accentPrimary} />
            </View>
          ) : (
            <View style={styles.offlineBadge}>
              <WifiOff size={12} color={Colors.accentWarning} />
            </View>
          )}
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
            <Edit3 size={16} color={Colors.accentPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── OFFLINE BANNER ──────────────────────────────────────── */}
      {!isOnline && (
        <OfflineBanner pendingCount={pendingOffline} onSync={syncData} />
      )}

      {/* ── SYNCING BANNER ──────────────────────────────────────── */}
      {isSyncing && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
          backgroundColor: Colors.accentPrimaryDim, borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md, paddingVertical: 8,
          borderWidth: 1, borderColor: Colors.accentPrimary,
        }}>
          <ActivityIndicator size="small" color={Colors.accentPrimary} />
          <Text style={{ fontSize: 12, color: Colors.accentPrimary, fontWeight: '500' }}>
            Syncing with GitHub...
          </Text>
        </View>
      )}

      {/* ── PROFILE CARD ────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <ProfileAvatar avatarUrl={profile?.avatarUrl} size={86} />

        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{profile?.name ?? profile?.login ?? 'GitHub User'}</Text>
          <Text style={styles.username}>{profile?.login ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.metaList}>
            {profile?.email && (
              <View style={styles.metaItem}>
                <Mail size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{profile.email}</Text>
              </View>
            )}
            {profile?.location && (
              <View style={styles.metaItem}>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{profile.location}</Text>
              </View>
            )}
            {joinedDate ? (
              <View style={styles.metaItem}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>Joined {joinedDate}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Users size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>
                {profile?.followers ?? 0} followers · {profile?.following ?? 0} following
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.7}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── KPI STATS ───────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        {displayStats.map(({ label, value, Icon, color }) => (
          <View key={label} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
              <Icon size={17} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── PENDING OFFLINE COMMITS INDICATOR ───────────────────── */}
      {pendingOffline > 0 && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
          paddingHorizontal: Spacing.sm, paddingVertical: 4,
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentWarning }} />
          <Text style={{ fontSize: 11, color: Colors.accentWarning }}>
            {pendingOffline} offline commit{pendingOffline > 1 ? 's' : ''} included in stats
          </Text>
        </View>
      )}

      {/* ── CONTRIBUTION CALENDAR ───────────────────────────────── */}
      <SectionHeader title="Contributions" />
      <ContributionHeatmap
        year={year}
        onYearChange={setYear}
        contribMap={currentContribMap}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        availableYears={availableYears}
      />

      {/* ── SELECTED DAY BANNER ─────────────────────────────────── */}
      {selectedDate && selectedCount > 0 && (
        <DayBanner
          dateStr={selectedDate}
          count={selectedCount}
          onClear={() => setSelectedDate(null)}
        />
      )}

      {/* ── CONTRIBUTION ACTIVITY ───────────────────────────────── */}
      <ContributionActivity
        selectedDate={selectedDate}
        activities={activities}
        loading={isLoading}
      />

      {/* ── LAST SYNC ───────────────────────────────────────────── */}
      <LastSyncInfo />

      {/* ── ACCOUNT ─────────────────────────────────────────────── */}
      <View style={[styles.card, { marginHorizontal: Spacing.md, marginBottom: Spacing.lg }]}>
        <TouchableOpacity
          style={styles.signOutRow}
          activeOpacity={0.6}
          onPress={async () => {
            await profileCache.clearAll();
            updateSettings({ githubToken: null, githubClientId: null });
            setProfile(null);
            setStats(null);
            setActivities([]);
            setContribMaps({});
            showToast('info', 'Signed out');
          }}
        >
          <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.accentDanger}18` }]}>
            <LogOut size={16} color={Colors.accentDanger} />
          </View>
          <Text style={[styles.rowLabel, { color: Colors.accentDanger, flex: 1 }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  editBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  onlineBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accentPrimaryDim, alignItems: 'center', justifyContent: 'center',
  },
  offlineBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(234, 179, 8, 0.1)', alignItems: 'center', justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    padding: Spacing.md, gap: Spacing.md, alignItems: 'flex-start',
  },
  profileInfo:  { flex: 1 },
  displayName:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 1 },
  username:     { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  bio: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: 8 },
  metaList: { gap: 4, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, color: Colors.textMuted },
  editProfileBtn: {
    borderWidth: 1, borderColor: Colors.borderDefault, borderRadius: Radius.sm,
    paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start',
  },
  editProfileText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '500' },

  statsGrid: {
    flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    alignItems: 'center', paddingVertical: Spacing.sm + 2, gap: 3,
  },
  statIconWrap: {
    width: 32, height: 32, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statLabel: {
    fontSize: 9, color: Colors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },

  card: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault, overflow: 'hidden',
  },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 13, gap: 12,
  },
  rowIconWrap: {
    width: 30, height: 30, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgTertiary,
  },
  rowLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
});
