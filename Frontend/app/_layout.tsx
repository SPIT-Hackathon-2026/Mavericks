// Polyfill Buffer for isomorphic-git on Hermes
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer as unknown as typeof globalThis.Buffer;
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { GitProvider, useGit } from "@/contexts/GitContext";
import { notificationService } from "@/services/notifications/notificationService";
import Toast from "@/components/Toast";
import NotificationBanner from "@/components/NotificationBanner";
import RecoveryAlert from "@/components/RecoveryAlert";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function ToastOverlay() {
  const { toastMessage } = useGit();
  if (!toastMessage) return null;
  return <Toast type={toastMessage.type} message={toastMessage.message} visible={!!toastMessage} />;
}

function RootLayoutNav() {
  return (
    <>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.bgSecondary },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { color: Colors.textPrimary },
          contentStyle: { backgroundColor: Colors.bgPrimary },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="repository/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="add-repo" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="create-repo" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="file-viewer" options={{ presentation: "fullScreenModal", headerShown: false }} />
        <Stack.Screen name="commit-detail" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="merge-conflicts" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="chatbot" options={{ headerShown: false }} />
      </Stack>
      <ToastOverlay />
      <NotificationBanner />
      <RecoveryAlert />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    // Initialize notification permissions on app boot
    notificationService.init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GitProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </GitProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
