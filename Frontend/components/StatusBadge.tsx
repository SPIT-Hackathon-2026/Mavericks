import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import type { ChangeType } from '@/types/git';

interface StatusBadgeProps {
  type: ChangeType;
  size?: 'sm' | 'md';
}

const badgeConfig: Record<ChangeType, { label: string; bg: string; color: string }> = {
  M: { label: 'M', bg: 'rgba(249, 115, 22, 0.2)', color: Colors.accentOrange },
  A: { label: 'A', bg: 'rgba(34, 197, 94, 0.2)', color: Colors.accentPrimary },
  D: { label: 'D', bg: 'rgba(239, 68, 68, 0.2)', color: Colors.accentDanger },
  R: { label: 'R', bg: 'rgba(168, 85, 247, 0.2)', color: Colors.accentPurple },
  U: { label: 'U', bg: 'rgba(107, 114, 128, 0.2)', color: Colors.statusUntracked },
};

export default function StatusBadge({ type, size = 'sm' }: StatusBadgeProps) {
  const config = badgeConfig[type];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSm]}>
      <Text style={[styles.text, { color: config.color }, isSmall && styles.textSm]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '700' as const,
    fontFamily: 'monospace',
  },
  textSm: {
    fontSize: 10,
  },
});
