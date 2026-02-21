import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GitCommit, GitBranch, GitMerge, Star, Clock,
  Mail, MapPin, Edit3, ChevronRight, Moon, Bell,
  Shield, Key, Info, LogOut, Zap, Code2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  name: 'Sarah Chen',
  username: 'sarahchen',
  email: 'sarah@gitlane.dev',
  location: 'San Francisco, CA',
  bio: 'Mobile engineer & open-source enthusiast. Building offline-first tools.',
  initials: 'SC',
  avatarColor: '#22C55E',
  joinedDate: 'Jan 2024',
};

const MOCK_STATS = [
  { label: 'Commits',    value: '1,247', Icon: GitCommit,  color: Colors.accentPrimary },
  { label: 'Repos',      value: '12',    Icon: Code2,      color: Colors.accentInfo },
  { label: 'Branches',   value: '34',    Icon: GitBranch,  color: Colors.accentPurple },
  { label: 'Merges',     value: '89',    Icon: GitMerge,   color: Colors.accentWarning },
];

const MOCK_ACTIVITY = [
  { message: 'feat: implement P2P transfer',  repo: 'gitlane-app',      time: '2h ago',   color: Colors.accentPrimary },
  { message: 'fix: resolve binary conflicts', repo: 'react-native-git', time: '5h ago',   color: Colors.accentDanger },
  { message: 'refactor: git object parsing',  repo: 'gitlane-app',      time: '2d ago',   color: Colors.accentInfo },
  { message: 'feat: syntax highlighting',     repo: 'portfolio-site',   time: '3d ago',   color: Colors.accentPurple },
  { message: 'chore: update dependencies',    repo: 'rust-cli-tools',   time: '1w ago',   color: Colors.accentWarning },
];

const MOCK_STARRED = [
  { name: 'gitlane-app',        lang: 'TypeScript', stars: 342 },
  { name: 'react-native-git',   lang: 'TypeScript', stars: 128 },
  { name: 'rust-cli-tools',     lang: 'Rust',       stars: 56  },
];

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3B82F6',
  Rust:       '#F97316',
  Python:     '#22C55E',
  JavaScript: '#EAB308',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sec.header}>
      <Text style={sec.title}>{title}</Text>
    </View>
  );
}

function SettingRow({
  Icon, label, sublabel, onPress, right,
}: {
  Icon: typeof Mail;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={row.container} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={row.iconWrap}>
        <Icon size={17} color={Colors.textSecondary} />
      </View>
      <View style={row.content}>
        <Text style={row.label}>{label}</Text>
        {sublabel && <Text style={row.sublabel}>{sublabel}</Text>}
      </View>
      {right ?? <ChevronRight size={15} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [darkMode,       setDarkMode]       = useState(true);
  const [notifications,  setNotifications]  = useState(true);
  const [autoFetch,      setAutoFetch]      = useState(false);

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
          <Edit3 size={17} color={Colors.accentPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Avatar card ─────────────────────────────────────────── */}
      <View style={styles.avatarCard}>
        <View style={[styles.avatar, { backgroundColor: MOCK_USER.avatarColor }]}>
          <Text style={styles.avatarInitials}>{MOCK_USER.initials}</Text>
          <View style={styles.avatarBadge}>
            <Zap size={10} color="#fff" fill="#fff" />
          </View>
        </View>

        <Text style={styles.displayName}>{MOCK_USER.name}</Text>
        <Text style={styles.username}>@{MOCK_USER.username}</Text>
        <Text style={styles.bio}>{MOCK_USER.bio}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Mail size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{MOCK_USER.email}</Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{MOCK_USER.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>Joined {MOCK_USER.joinedDate}</Text>
          </View>
        </View>
      </View>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        {MOCK_STATS.map(({ label, value, Icon, color }) => (
          <View key={label} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
              <Icon size={18} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Recent Activity ─────────────────────────────────────── */}
      <SectionHeader title="Recent Activity" />
      <View style={styles.card}>
        {MOCK_ACTIVITY.map((item, i) => (
          <View
            key={i}
            style={[styles.activityRow, i < MOCK_ACTIVITY.length - 1 && styles.activityDivider]}
          >
            <View style={[styles.activityDot, { backgroundColor: item.color }]} />
            <View style={styles.activityContent}>
              <Text style={styles.activityMessage} numberOfLines={1}>{item.message}</Text>
              <Text style={styles.activityMeta}>{item.repo} · {item.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Starred Repos ───────────────────────────────────────── */}
      <SectionHeader title="Starred Repos" />
      <View style={styles.card}>
        {MOCK_STARRED.map((repo, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.repoRow, i < MOCK_STARRED.length - 1 && styles.activityDivider]}
            activeOpacity={0.6}
          >
            <Star size={15} color={Colors.accentWarning} fill={Colors.accentWarning} />
            <View style={styles.repoContent}>
              <Text style={styles.repoName}>{repo.name}</Text>
              <View style={styles.repoMeta}>
                <View style={[styles.langDot, { backgroundColor: LANG_COLORS[repo.lang] ?? Colors.textMuted }]} />
                <Text style={styles.repoMetaText}>{repo.lang}</Text>
                <Text style={styles.repoMetaText}>·</Text>
                <Star size={11} color={Colors.textMuted} />
                <Text style={styles.repoMetaText}>{repo.stars}</Text>
              </View>
            </View>
            <ChevronRight size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Preferences ─────────────────────────────────────────── */}
      <SectionHeader title="Preferences" />
      <View style={styles.card}>
        <SettingRow
          Icon={Moon}
          label="Dark Mode"
          sublabel="Always on dark theme"
          right={
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: Colors.bgTertiary, true: Colors.accentPrimary }}
              thumbColor="#fff"
              ios_backgroundColor={Colors.bgTertiary}
            />
          }
        />
        <View style={styles.rowDivider} />
        <SettingRow
          Icon={Bell}
          label="Notifications"
          sublabel="Commit and sync alerts"
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: Colors.bgTertiary, true: Colors.accentPrimary }}
              thumbColor="#fff"
              ios_backgroundColor={Colors.bgTertiary}
            />
          }
        />
        <View style={styles.rowDivider} />
        <SettingRow
          Icon={Zap}
          label="Auto Fetch"
          sublabel="Fetch remotes on app open"
          right={
            <Switch
              value={autoFetch}
              onValueChange={setAutoFetch}
              trackColor={{ false: Colors.bgTertiary, true: Colors.accentPrimary }}
              thumbColor="#fff"
              ios_backgroundColor={Colors.bgTertiary}
            />
          }
        />
      </View>

      {/* ── Account ─────────────────────────────────────────────── */}
      <SectionHeader title="Account" />
      <View style={styles.card}>
        <SettingRow Icon={Key}    label="SSH Keys"          sublabel="Manage authentication keys" />
        <View style={styles.rowDivider} />
        <SettingRow Icon={Shield} label="Security"          sublabel="Two-factor authentication" />
        <View style={styles.rowDivider} />
        <SettingRow Icon={Info}   label="About GitLane"     sublabel="Version 1.0.0" />
        <View style={styles.rowDivider} />
        <TouchableOpacity style={[styles.row, styles.signOutRow]} activeOpacity={0.6}>
          <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.accentDanger}18` }]}>
            <LogOut size={17} color={Colors.accentDanger} />
          </View>
          <Text style={[styles.rowLabel, { color: Colors.accentDanger }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },

  // Avatar card
  avatarCard: {
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.glow,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgSecondary,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: Colors.accentPrimary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  bio: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  metaRow: {
    gap: 6,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Card wrapper
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  activityDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  activityMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Starred repos
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  repoContent: {
    flex: 1,
  },
  repoName: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  repoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  repoMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Setting rows
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderMuted,
    marginLeft: Spacing.md + 36,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  signOutRow: {
    // extra styling handled inline
  },
});

const sec = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  sublabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});

