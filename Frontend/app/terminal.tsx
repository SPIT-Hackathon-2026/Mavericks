// Legacy standalone terminal screen kept for compatibility; not used in tab bar
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import { Spacing } from "@/constants/theme";

export default function Terminal() {
  return (
    <View style={[styles.root, { paddingTop: Spacing.lg }]}>
      <Text style={styles.title}>Terminal is now available per-repository.</Text>
      <Text style={styles.subtitle}>Open any repository and switch to the Terminal tab.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  title: { fontSize: 16, fontWeight: "700" as const, color: Colors.textPrimary, textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
});
