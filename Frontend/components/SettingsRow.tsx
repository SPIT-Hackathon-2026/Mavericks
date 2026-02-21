import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

interface SettingsRowProps {
  icon?: React.ReactNode;
  title: string;
  value?: string;
  onPress?: () => void;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  danger?: boolean;
  isLast?: boolean;
}

export default function SettingsRow({
  icon, title, value, onPress, isToggle, toggleValue, onToggle, danger, isLast,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.row, !isLast && styles.border]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <View style={styles.content}>
        <Text style={[styles.title, danger && styles.dangerText]}>{title}</Text>
      </View>
      {isToggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.bgTertiary, true: Colors.accentPrimary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={Colors.bgTertiary}
        />
      ) : value ? (
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          <ChevronRight size={16} color={Colors.textMuted} />
        </View>
      ) : onPress ? (
        <ChevronRight size={16} color={Colors.textMuted} />
      ) : null}
    </View>
  );

  if (onPress && !isToggle) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  iconWrap: {
    width: 32,
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  dangerText: {
    color: Colors.accentDanger,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
