import React, { useRef } from 'react';
import { Text, StyleSheet, Animated, TouchableWithoutFeedback, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Radius, Shadows } from '@/constants/theme';

interface GlowButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function GlowButton({
  title, onPress, variant = 'primary', disabled = false, icon, fullWidth = false, size = 'md',
}: GlowButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 200, friction: 15 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 15 }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const heights = { sm: 36, md: 44, lg: 48 };
  const fontSizes = { sm: 13, md: 14, lg: 15 };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.base,
          { height: heights[size], transform: [{ scale }] },
          variant === 'primary' && styles.primary,
          variant === 'secondary' && styles.secondary,
          variant === 'outline' && styles.outline,
          variant === 'danger' && styles.danger,
          variant === 'ghost' && styles.ghost,
          variant === 'primary' && !disabled && Shadows.glow,
          disabled && styles.disabled,
          fullWidth && styles.fullWidth,
        ]}
      >
        {icon}
        <Text
          style={[
            styles.text,
            { fontSize: fontSizes[size] },
            variant === 'outline' && styles.outlineText,
            variant === 'ghost' && styles.ghostText,
            variant === 'secondary' && styles.secondaryText,
            disabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: 20,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: Colors.accentPrimary,
  },
  secondary: {
    backgroundColor: Colors.bgTertiary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  danger: {
    backgroundColor: Colors.accentDanger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: Colors.bgTertiary,
    shadowOpacity: 0,
    elevation: 0,
    borderColor: Colors.borderDefault,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  outlineText: {
    color: Colors.accentPrimary,
  },
  ghostText: {
    color: Colors.textSecondary,
  },
  secondaryText: {
    color: Colors.textPrimary,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});
