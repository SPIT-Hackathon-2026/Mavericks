import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Switch,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Folder, CheckCircle, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import type { Repository } from '@/types/git';

export default function CreateRepoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRepository } = useGit();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('/storage/GitLane/');
  const [addReadme, setAddReadme] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('None');
  const [creating, setCreating] = useState(false);

  const isValid = name.trim().length > 0 && !name.includes(' ');

  const handleCreate = useCallback(() => {
    if (!isValid || creating) return;
    setCreating(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setTimeout(() => {
      const newRepo: Repository = {
        id: Date.now().toString(),
        name: name.trim(),
        path: `${location}${name.trim()}`,
        currentBranch: 'main',
        branches: [{
          name: 'main',
          isRemote: false,
          isCurrent: true,
          lastCommitSha: Math.random().toString(36).substring(2, 9),
          lastCommitMessage: 'Initial commit',
        }],
        stagedCount: 0,
        modifiedCount: 0,
        conflictCount: 0,
        lastActivity: 'Just now',
        size: '< 1 MB',
        commitCount: addReadme ? 1 : 0,
      };
      addRepository(newRepo);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCreating(false);
      router.dismiss();
    }, 1200);
  }, [name, location, addReadme, isValid, creating, addRepository, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Repository</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Repository Name</Text>
          <View style={[styles.inputWrap, isValid && name.length > 0 && styles.inputValid]}>
            <Folder size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="my-awesome-project"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isValid && name.length > 0 && <CheckCircle size={18} color={Colors.accentPrimary} />}
          </View>
          {name.includes(' ') && (
            <Text style={styles.errorText}>Spaces not allowed in repository names</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationRow}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.browseBtn}>
              <Text style={styles.browseBtnText}>Browse</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>Add README.md</Text>
            <Text style={styles.toggleHelper}>Creates an initial README file</Text>
          </View>
          <Switch
            value={addReadme}
            onValueChange={setAddReadme}
            trackColor={{ false: Colors.bgTertiary, true: Colors.accentPrimary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={Colors.bgTertiary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>.gitignore Template</Text>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>{gitignoreTemplate}</Text>
            <ChevronDown size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.templateOptions}>
            {['None', 'Node', 'Python', 'React Native'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.templateChip, gitignoreTemplate === t && styles.templateChipActive]}
                onPress={() => setGitignoreTemplate(t)}
              >
                <Text style={[styles.templateChipText, gitignoreTemplate === t && styles.templateChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.createBtn,
            Shadows.glow,
            (!isValid || creating) && styles.createBtnDisabled,
          ]}
          onPress={handleCreate}
          disabled={!isValid || creating}
          activeOpacity={0.8}
        >
          {creating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.createBtnText}>Creating...</Text>
            </>
          ) : (
            <Text style={[styles.createBtnText, !isValid && styles.createBtnTextDisabled]}>
              Create Repository
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  form: {
    flex: 1,
  },
  formContent: {
    padding: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    height: 52,
    paddingHorizontal: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  inputValid: {
    borderColor: Colors.accentPrimary,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: Colors.accentDanger,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  browseBtn: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.sm,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  browseBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.accentPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  toggleHelper: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    height: 48,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.sm,
  },
  dropdownText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  templateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  templateChipActive: {
    backgroundColor: Colors.accentPrimaryDim,
    borderColor: Colors.accentPrimary,
  },
  templateChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  templateChipTextActive: {
    color: Colors.accentPrimary,
    fontWeight: '600' as const,
  },
  createBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.md,
  },
  createBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  createBtnTextDisabled: {
    color: Colors.textMuted,
  },
});
