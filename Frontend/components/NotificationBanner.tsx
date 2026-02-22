import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  notificationService,
  NotificationItem,
} from '@/services/notifications/notificationService';

const iconMap = {
  success: { Icon: CheckCircle, color: Colors.accentPrimary },
  error: { Icon: XCircle, color: Colors.accentDanger },
  warning: { Icon: AlertTriangle, color: Colors.accentWarning },
  info: { Icon: Info, color: Colors.accentInfo },
};

const borderMap: Record<string, string> = {
  success: Colors.accentPrimary,
  error: Colors.accentDanger,
  warning: Colors.accentWarning,
  info: Colors.accentInfo,
};

export default function NotificationBanner() {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsub = notificationService.subscribe((n) => {
      setNotification(n);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (notification) {
      // Reset position before animating in
      translateY.setValue(-140);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [notification]);

  if (!notification) return null;

  const { Icon, color } = iconMap[notification.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + Spacing.xs,
          transform: [{ translateY }],
          opacity,
          borderLeftColor: borderMap[notification.type],
        },
      ]}
      pointerEvents="none"
    >
      <Icon size={22} color={color} />
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10000,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
});
