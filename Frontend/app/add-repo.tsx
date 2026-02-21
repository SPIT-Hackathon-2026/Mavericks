import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, FolderPlus, FolderDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

export default function AddRepoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCreate = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace('/create-repo');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Repository</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.optionCard} onPress={handleCreate} activeOpacity={0.7}>
          <View style={styles.optionIconWrap}>
            <FolderPlus size={40} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.optionTitle}>Create New</Text>
          <Text style={styles.optionSubtitle}>Initialize a fresh Git repository</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, styles.optionCardSecondary]}
          activeOpacity={0.7}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <View style={[styles.optionIconWrap, styles.optionIconWrapSecondary]}>
            <FolderDown size={40} color={Colors.accentSecondary} />
          </View>
          <Text style={styles.optionTitle}>Import Existing</Text>
          <Text style={styles.optionSubtitle}>Add a repository from device storage</Text>
        </TouchableOpacity>

        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>RECENT LOCATIONS</Text>
          <View style={styles.recentEmpty}>
            <Text style={styles.recentEmptyText}>No recent locations</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.md,
    flex: 1,
  },
  optionCard: {
    backgroundColor: Colors.accentPrimaryDim,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  optionCardSecondary: {
    backgroundColor: Colors.bgTertiary,
    borderColor: Colors.borderDefault,
  },
  optionIconWrap: {
    marginBottom: Spacing.md,
  },
  optionIconWrapSecondary: {},
  optionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  recentSection: {
    marginTop: Spacing.lg,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  recentEmpty: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  recentEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
