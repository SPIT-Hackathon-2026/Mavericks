import { Tabs } from "expo-router";
import { GitBranch, GitGraph, QrCode, Settings, UserCircle } from "lucide-react-native";
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

function TabIcon({ Icon, focused }: { Icon: typeof GitBranch; focused: boolean }) {
  return (
    <View style={styles.iconContainer}>
      {focused && <View style={styles.activeIndicator} />}
      <Icon size={24} color={focused ? Colors.accentPrimary : Colors.textMuted} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accentPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.borderDefault,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' ? { height: 65 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="(repos)"
        options={{
          title: "Repos",
          tabBarIcon: ({ focused }) => <TabIcon Icon={GitBranch} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: "Graph",
          tabBarIcon: ({ focused }) => <TabIcon Icon={GitGraph} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon Icon={UserCircle} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: "Transfer",
          tabBarIcon: ({ focused }) => <TabIcon Icon={QrCode} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.accentPrimary,
  },
});
