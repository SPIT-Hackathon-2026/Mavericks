import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
}

export default function EmptyState({ icon, title, subtitle, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {primaryAction && (
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, Shadows.glow]}
          onPress={primaryAction.onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryText}>{primaryAction.label}</Text>
        </TouchableOpacity>
      )}
      {secondaryAction && (
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={secondaryAction.onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryText}>{secondaryAction.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconWrapper: {
    marginBottom: Spacing.lg,
    opacity: 0.4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  button: {
    width: '100%',
    maxWidth: 280,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accentPrimary,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  secondaryText: {
    color: Colors.accentPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
});