import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  visible: boolean;
}

const iconMap = {
  success: { Icon: CheckCircle, color: Colors.accentPrimary },
  error: { Icon: XCircle, color: Colors.accentDanger },
  warning: { Icon: AlertTriangle, color: Colors.accentWarning },
  info: { Icon: Info, color: Colors.accentInfo },
};

const borderMap = {
  success: Colors.accentPrimary,
  error: Colors.accentDanger,
  warning: Colors.accentWarning,
  info: Colors.accentInfo,
};

export default function Toast({ type, message, visible }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { Icon, color } = iconMap[type];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + Spacing.sm, transform: [{ translateY }], opacity, borderLeftColor: borderMap[type] },
      ]}
      pointerEvents="none"
    >
      <Icon size={20} color={color} />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
