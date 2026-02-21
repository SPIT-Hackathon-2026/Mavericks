import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GitCommit, GitBranch, GitMerge, Clock,
  Mail, MapPin, Edit3, LogOut, Code2, User,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const CELL     = 11;
const CELL_GAP = 2;
const COL_W    = CELL + CELL_GAP;
const DAY_LABEL_W = 28;

// ─── Mock user ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  name:       'Harshal Shah',
  username:   'HarshalShah2005',
  email:      'harshal@gitlane.dev',
  location:   'India',
  bio:        'Mobile engineer & open-source enthusiast. Building offline-first tools.',
  joinedDate: 'Jan 2024',
  linkedin:   'in/harshal-shah-60429a317',
};

// ─── KPI stats ────────────────────────────────────────────────────────────────

const MOCK_STATS = [
  { label: 'Commits',  value: '1,247', Icon: GitCommit, color: Colors.accentPrimary },
  { label: 'Repos',    value: '12',    Icon: Code2,     color: Colors.accentInfo    },
  { label: 'Branches', value: '34',    Icon: GitBranch, color: Colors.accentPurple  },
  { label: 'Merges',   value: '89',    Icon: GitMerge,  color: Colors.accentWarning },
];

// ─── Contribution data ────────────────────────────────────────────────────────

type ContribMap = Record<string, number>;

const CONTRIBS_2025: ContribMap = {
  '2025-04-07': 3, '2025-04-08': 1, '2025-04-14': 2,
  '2025-08-12': 1,
  '2025-10-13': 2, '2025-10-14': 1,
  '2025-10-27': 3, '2025-10-28': 5, '2025-10-29': 4, '2025-10-30': 2,
  '2025-11-03': 6, '2025-11-04': 4, '2025-11-05': 3, '2025-11-06': 2,
  '2025-11-10': 5, '2025-11-11': 7, '2025-11-12': 3,
  '2025-11-17': 8, '2025-11-18': 5, '2025-11-19': 4,
  '2025-11-24': 3, '2025-11-25': 2,
  '2025-12-01': 5, '2025-12-02': 3, '2025-12-08': 4,
  '2025-12-15': 2, '2025-12-22': 1, '2025-12-25': 1,
};

const CONTRIBS_2024: ContribMap = {
  '2024-01-15': 2, '2024-02-03': 3, '2024-02-18': 1,
  '2024-03-10': 4, '2024-03-11': 5, '2024-03-25': 2,
  '2024-04-08': 3, '2024-05-12': 2, '2024-06-20': 4,
  '2024-07-04': 1, '2024-08-14': 3, '2024-08-15': 2,
  '2024-09-05': 5, '2024-09-06': 3, '2024-10-10': 2,
  '2024-11-11': 4, '2024-12-05': 1, '2024-12-24': 3,
};

const CONTRIBS_2026: ContribMap = {
  '2026-01-05': 2, '2026-01-06': 3, '2026-01-20': 1,
  '2026-02-03': 4, '2026-02-04': 5, '2026-02-10': 2,
};

const CONTRIB_MAPS: Record<number, ContribMap> = {
  2024: CONTRIBS_2024,
  2025: CONTRIBS_2025,
  2026: CONTRIBS_2026,
};

function totalContribs(map: ContribMap) {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

// ─── Activity data per date ───────────────────────────────────────────────────

interface Activity {
  type:   'commit' | 'repo';
  msg:    string;
  repo:   string;
  detail: string;
  date:   string;
}

const DATE_ACTIVITIES: Record<string, Activity[]> = {
  '2025-10-28': [
    { type: 'commit', msg: 'Created 5 commits in 1 repository',
      repo: 'traveller318/mini-project', detail: '5 commits', date: 'Oct 28' },
  ],
  '2025-12-01': [
    { type: 'commit', msg: 'Created 5 commits in 1 repository',
      repo: 'HarshalShah2005/portfolio', detail: '5 commits', date: 'Dec 1' },
  ],
  '2025-12-25': [
    { type: 'repo', msg: 'Created 1 repository',
      repo: 'HarshalShah2005/portfolio', detail: 'TypeScript', date: 'Dec 25' },
  ],
  '2025-11-17': [
    { type: 'commit', msg: 'Created 8 commits in 2 repositories',
      repo: 'HarshalShah2005/gitlane-app', detail: '6 commits', date: 'Nov 17' },
    { type: 'commit', msg: '',
      repo: 'HarshalShah2005/react-native-git', detail: '2 commits', date: 'Nov 17' },
  ],
  '2025-11-11': [
    { type: 'commit', msg: 'Created 7 commits in 1 repository',
      repo: 'HarshalShah2005/gitlane-app', detail: '7 commits', date: 'Nov 11' },
  ],
};

const ALL_RECENT_ACTIVITY: Activity[] = [
  { type: 'commit', msg: 'Created 5 commits in 1 repository',
    repo: 'HarshalShah2005/portfolio',         detail: '5 commits', date: 'Dec 1'  },
  { type: 'commit', msg: 'Created 8 commits in 2 repositories',
    repo: 'HarshalShah2005/gitlane-app',       detail: '6 commits', date: 'Nov 17' },
  { type: 'commit', msg: 'Created 7 commits in 1 repository',
    repo: 'HarshalShah2005/gitlane-app',       detail: '7 commits', date: 'Nov 11' },
  { type: 'commit', msg: 'Created 5 commits in 1 repository',
    repo: 'traveller318/mini-project',          detail: '5 commits', date: 'Oct 28' },
  { type: 'repo',   msg: 'Created 1 repository',
    repo: 'HarshalShah2005/portfolio',          detail: 'TypeScript', date: 'Dec 25' },
];

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface WeekData {
  days: { dateStr: string; count: number; month: number }[];
  monthLabel: string | null; // show month label at top of this column
}

function buildWeeks(year: number, map: ContribMap): WeekData[] {
  // Start from the first Sunday on or before Jan 1
  const jan1   = new Date(year, 0, 1);
  const start  = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay());

  const dec31  = new Date(year, 11, 31);
  const end    = new Date(dec31);
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
    // show month label on Sunday of that week if month changed
    const firstOfWeekMonth = days[0].month;
    const label = (firstOfWeekMonth !== lastMonth && days[0].dateStr.startsWith(String(year)))
      ? MONTH_NAMES[firstOfWeekMonth]
      : null;
    if (label) lastMonth = firstOfWeekMonth;
    weeks.push({ days, monthLabel: label });
  }
  return weeks;
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

// ─── Avatar (generic person silhouette) ──────────────────────────────────────

function PersonAvatar({ size = 80 }: { size?: number }) {
  const headR  = size * 0.22;
  const bodyW  = size * 0.54;
  const bodyH  = size * 0.28;
  const bodyY  = size * 0.54;
  return (
    <View style={[avatarSt.circle, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#3A3F47',
    }]}>
      {/* head */}
      <View style={{
        width:  headR * 2, height: headR * 2,
        borderRadius: headR,
        backgroundColor: '#9AA3AF',
        position: 'absolute',
        top: size * 0.16,
        alignSelf: 'center',
      }} />
      {/* body arc */}
      <View style={{
        width:  bodyW, height: bodyH + bodyW / 2,
        borderTopLeftRadius:  bodyW / 2,
        borderTopRightRadius: bodyW / 2,
        backgroundColor: '#9AA3AF',
        position: 'absolute',
        bottom: 0,
        alignSelf: 'center',
      }} />
    </View>
  );
}

const avatarSt = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

// ─── Contribution Heatmap ─────────────────────────────────────────────────────

function ContributionHeatmap({
  year, onYearChange, contribMap, selectedDate, onSelectDate,
}: {
  year:          number;
  onYearChange:  (y: number) => void;
  contribMap:    ContribMap;
  selectedDate:  string | null;
  onSelectDate:  (d: string | null) => void;
}) {
  const weeks  = useMemo(() => buildWeeks(year, contribMap), [year, contribMap]);
  const total  = useMemo(() => totalContribs(contribMap), [contribMap]);
  const years  = [2024, 2025, 2026];

  return (
    <View style={hm.wrapper}>
      {/* title + year selector */}
      <View style={hm.topRow}>
        <Text style={hm.totalText}>
          <Text style={hm.totalNum}>{total}</Text> contributions in {year}
        </Text>
        <View style={hm.yearPicker}>
          {years.map(y => (
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

      {/* calendar grid */}
      <View style={hm.gridOuter}>
        {/* day-of-week labels */}
        <View style={hm.dayLabels}>
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <Text key={i} style={hm.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* weeks scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' }}>
            {/* month labels row */}
            <View style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0 }}>
              {weeks.map((w, wi) => (
                <View key={wi} style={{ width: COL_W }}>
                  {w.monthLabel
                    ? <Text style={hm.monthLabel}>{w.monthLabel}</Text>
                    : <View style={{ height: 14 }} />}
                </View>
              ))}
            </View>

            {/* cells */}
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              {weeks.map((w, wi) => (
                <View key={wi} style={hm.weekCol}>
                  {w.days.map((day, di) => {
                    const inYear  = day.dateStr.startsWith(String(year));
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

      {/* legend */}
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
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
    gap: 6,
  },
  totalText: { fontSize: 13, color: Colors.textSecondary },
  totalNum:  { fontWeight: '700', color: Colors.textPrimary },
  yearPicker:    { flexDirection: 'row', gap: 4 },
  yearBtn:       {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  yearBtnActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  yearBtnText:       { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  yearBtnTextActive: { color: '#fff', fontWeight: '700' },
  gridOuter: { flexDirection: 'row' },
  dayLabels: { width: DAY_LABEL_W, marginTop: 16 },
  dayLabel:  { height: COL_W, fontSize: 9, color: Colors.textMuted, textAlignVertical: 'center' },
  monthLabel:{ height: 14, fontSize: 9, color: Colors.textMuted },
  weekCol: { flexDirection: 'column', marginRight: CELL_GAP },
  cell: {
    width: CELL, height: CELL,
    borderRadius: 2,
    marginBottom: CELL_GAP,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: Colors.accentPrimary,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    justifyContent: 'flex-end',
  },
  legendLabel: { fontSize: 10, color: Colors.textMuted },
  legendCell:  { width: 10, height: 10, borderRadius: 2 },
});

// ─── Contribution Activity ────────────────────────────────────────────────────

function ContributionActivity({
  selectedDate, year,
}: {
  selectedDate: string | null;
  year: number;
}) {
  const items: Activity[] = selectedDate
    ? (DATE_ACTIVITIES[selectedDate] ?? [])
    : ALL_RECENT_ACTIVITY.filter(a => a.date.includes(String(year).slice(2)));

  const displayItems = selectedDate ? items : ALL_RECENT_ACTIVITY;
  const heading = selectedDate
    ? formatDisplayDate(selectedDate)
    : 'Contribution activity';

  return (
    <View style={{ marginHorizontal: Spacing.md, marginBottom: Spacing.md }}>
      <Text style={ca.heading}>{heading}</Text>

      {displayItems.length === 0 && (
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
              {item.type === 'repo' && (
                <View style={ca.langDot} />
              )}
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

      <TouchableOpacity style={ca.showMore} activeOpacity={0.7}>
        <Text style={ca.showMoreText}>Show more activity</Text>
      </TouchableOpacity>
    </View>
  );
}

const ca = StyleSheet.create({
  heading: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyBox: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    gap: 10,
  },
  iconCol: { alignItems: 'center' },
  iconCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accentPrimaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { flex: 1, width: 1, backgroundColor: Colors.borderMuted, marginTop: 4 },
  body: { flex: 1 },
  msg:  { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  repo: { fontSize: 12, color: Colors.accentInfo, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.accentInfo,
  },
  detail: { fontSize: 11, color: Colors.textSecondary },
  bar: {
    flex: 1, height: 5,
    backgroundColor: Colors.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.accentPrimary, borderRadius: 3 },
  dateLabel: { fontSize: 11, color: Colors.textMuted },
  showMore: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    marginTop: 4,
  },
  showMoreText: { fontSize: 13, color: Colors.accentInfo, fontWeight: '500' },
});

// ─── Selected day banner ──────────────────────────────────────────────────────

function DayBanner({ dateStr, count, onClear }: {
  dateStr: string; count: number; onClear: () => void;
}) {
  return (
    <View style={banner.row}>
      <View style={banner.dot} />
      <Text style={banner.text}>
        <Text style={banner.count}>{count}</Text>
        {` contribution${count !== 1 ? 's' : ''} on ${formatDisplayDate(dateStr)}`}
      </Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={banner.clear}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const banner = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.accentPrimaryDim,
    borderRadius: Radius.sm,
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

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [year,          setYear]          = useState(2025);
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null);


  const contribMap = CONTRIB_MAPS[year];
  const selectedCount = selectedDate ? (contribMap[selectedDate] ?? 0) : 0;

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
          <Edit3 size={16} color={Colors.accentPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── PROFILE CARD ────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <PersonAvatar size={86} />

        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{MOCK_USER.name}</Text>
          <Text style={styles.username}>{MOCK_USER.username}</Text>
          <Text style={styles.bio}>{MOCK_USER.bio}</Text>

          <View style={styles.metaList}>
            <View style={styles.metaItem}>
              <Mail size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{MOCK_USER.email}</Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{MOCK_USER.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>Joined {MOCK_USER.joinedDate}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.7}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── KPI STATS ───────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        {MOCK_STATS.map(({ label, value, Icon, color }) => (
          <View key={label} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
              <Icon size={17} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── CONTRIBUTION CALENDAR ───────────────────────────────── */}
      <SectionHeader title="Contributions" />
      <ContributionHeatmap
        year={year}
        onYearChange={setYear}
        contribMap={contribMap}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
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
      <ContributionActivity selectedDate={selectedDate} year={year} />

      {/* ── ACCOUNT ─────────────────────────────────────────────── */}
      <View style={[styles.card, { marginHorizontal: Spacing.md, marginBottom: Spacing.lg }]}>
        <TouchableOpacity style={styles.signOutRow} activeOpacity={0.6}>
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
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  profileInfo:  { flex: 1 },
  displayName:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 1 },
  username:     { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  bio: {
    fontSize: 12, color: Colors.textSecondary,
    lineHeight: 17, marginBottom: 8,
  },
  metaList: { gap: 4, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, color: Colors.textMuted },
  editProfileBtn: {
    borderWidth: 1, borderColor: Colors.borderDefault,
    borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  editProfileText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '500' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    alignItems: 'center', paddingVertical: Spacing.sm + 2, gap: 3,
  },
  statIconWrap: {
    width: 32, height: 32, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statLabel: {
    fontSize: 9, color: Colors.textMuted,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3,
  },

  // Card
  card: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderMuted,
    marginLeft: Spacing.md + 36,
  },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 13, gap: 12,
  },
  rowIconWrap: {
    width: 30, height: 30, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
  },
  rowLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
});



