import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Mail, Bell, BellOff, Palette, Type, HardDrive, Trash2,
  Download, Wifi, Eye, RefreshCw, HeartPulse, FileText, Info,
  Shield, FileCheck, X, Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import SettingsSection from '@/components/SettingsSection';
import SettingsRow from '@/components/SettingsRow';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, showToast } = useGit();
  const [editModal, setEditModal] = useState<'name' | 'email' | null>(null);
  const [editValue, setEditValue] = useState('');

  const openEdit = (field: 'name' | 'email') => {
    setEditValue(field === 'name' ? settings.userConfig.name : settings.userConfig.email);
    setEditModal(field);
  };

  const saveEdit = () => {
    if (!editModal) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (editModal === 'name') {
      updateSettings({ userConfig: { ...settings.userConfig, name: editValue } });
    } else {
      updateSettings({ userConfig: { ...settings.userConfig, email: editValue } });
    }
    showToast('success', `${editModal === 'name' ? 'Name' : 'Email'} updated`);
    setEditModal(null);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will remove 45 MB of cached data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => showToast('success', 'Cache cleared'),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Git Identity">
          <SettingsRow
            icon={<User size={18} color={Colors.accentPrimary} />}
            title="User Name"
            value={settings.userConfig.name}
            onPress={() => openEdit('name')}
          />
          <SettingsRow
            icon={<Mail size={18} color={Colors.accentPrimary} />}
            title="Email Address"
            value={settings.userConfig.email}
            onPress={() => openEdit('email')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            icon={<Bell size={18} color={Colors.accentPrimary} />}
            title="Commit Success"
            isToggle
            toggleValue={settings.notifications.commitSuccess}
            onToggle={(val) => updateSettings({ notifications: { ...settings.notifications, commitSuccess: val } })}
          />
          <SettingsRow
            icon={<BellOff size={18} color={Colors.accentDanger} />}
            title="Commit Failed"
            isToggle
            toggleValue={settings.notifications.commitFailed}
            onToggle={(val) => updateSettings({ notifications: { ...settings.notifications, commitFailed: val } })}
          />
          <SettingsRow
            icon={<Bell size={18} color={Colors.accentWarning} />}
            title="Merge Conflicts"
            isToggle
            toggleValue={settings.notifications.mergeConflicts}
            onToggle={(val) => updateSettings({ notifications: { ...settings.notifications, mergeConflicts: val } })}
          />
          <SettingsRow
            icon={<Bell size={18} color={Colors.textMuted} />}
            title="Background Tasks"
            isToggle
            toggleValue={settings.notifications.backgroundTasks}
            onToggle={(val) => updateSettings({ notifications: { ...settings.notifications, backgroundTasks: val } })}
          />
          <SettingsRow
            icon={<Bell size={18} color={Colors.accentInfo} />}
            title="P2P Transfers"
            isToggle
            toggleValue={settings.notifications.p2pTransfers}
            onToggle={(val) => updateSettings({ notifications: { ...settings.notifications, p2pTransfers: val } })}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsRow
            icon={<Palette size={18} color={Colors.accentPrimary} />}
            title="Theme"
            value="Dark"
          />
          <SettingsRow
            icon={<Type size={18} color={Colors.accentPrimary} />}
            title="Code Font Size"
            value={`${settings.codeFontSize}px`}
            onPress={() => {
              const newSize = settings.codeFontSize >= 18 ? 10 : settings.codeFontSize + 1;
              updateSettings({ codeFontSize: newSize });
            }}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Storage">
          <SettingsRow
            icon={<HardDrive size={18} color={Colors.accentPrimary} />}
            title="Storage Used"
            value="1.2 GB"
          />
          <SettingsRow
            icon={<Trash2 size={18} color={Colors.accentDanger} />}
            title="Clear Cache"
            value="45 MB"
            onPress={handleClearCache}
            danger
          />
          <SettingsRow
            icon={<Download size={18} color={Colors.accentPrimary} />}
            title="Export All"
            onPress={() => showToast('info', 'Export started')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="P2P">
          <SettingsRow
            icon={<Wifi size={18} color={Colors.accentPrimary} />}
            title="Default Method"
            value="Wi-Fi Direct"
          />
          <SettingsRow
            icon={<Shield size={18} color={Colors.accentPrimary} />}
            title="Auto-accept Known Devices"
            isToggle
            toggleValue={settings.autoAcceptKnown}
            onToggle={(val) => updateSettings({ autoAcceptKnown: val })}
          />
          <SettingsRow
            icon={<Eye size={18} color={Colors.accentPrimary} />}
            title="Discovery Visibility"
            isToggle
            toggleValue={settings.discoveryVisible}
            onToggle={(val) => updateSettings({ discoveryVisible: val })}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Advanced">
          <SettingsRow
            icon={<RefreshCw size={18} color={Colors.accentPrimary} />}
            title="Enable Reflog"
            isToggle
            toggleValue={settings.enableReflog}
            onToggle={(val) => updateSettings({ enableReflog: val })}
          />
          <SettingsRow
            icon={<Trash2 size={18} color={Colors.accentPrimary} />}
            title="Garbage Collection"
            onPress={() => showToast('success', 'GC completed')}
          />
          <SettingsRow
            icon={<HeartPulse size={18} color={Colors.accentPrimary} />}
            title="Repository Health"
            onPress={() => showToast('success', 'All repos healthy')}
          />
          <SettingsRow
            icon={<FileText size={18} color={Colors.textSecondary} />}
            title="View Crash Logs"
            onPress={() => {}}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow
            icon={<Info size={18} color={Colors.textSecondary} />}
            title="Version"
            value="1.0.0"
          />
          <SettingsRow
            title="Build"
            value="20260221"
          />
          <SettingsRow
            icon={<FileCheck size={18} color={Colors.textSecondary} />}
            title="Open Source Licenses"
            onPress={() => {}}
          />
          <SettingsRow
            title="Privacy Policy"
            onPress={() => {}}
          />
          <SettingsRow
            title="Terms of Service"
            onPress={() => {}}
            isLast
          />
        </SettingsSection>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={editModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModal(null)}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editModal === 'name' ? 'Edit Name' : 'Edit Email'}
              </Text>
              <TouchableOpacity onPress={saveEdit}>
                <Check size={22} color={Colors.accentPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editModal === 'name' ? 'Your name' : 'your@email.com'}
              placeholderTextColor={Colors.textMuted}
              autoFocus
              keyboardType={editModal === 'email' ? 'email-address' : 'default'}
              autoCapitalize={editModal === 'email' ? 'none' : 'words'}
            />
            <Text style={styles.modalHelper}>
              Used for all commits from this device
            </Text>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  modalInput: {
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    height: 52,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.sm,
  },
  modalHelper: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
