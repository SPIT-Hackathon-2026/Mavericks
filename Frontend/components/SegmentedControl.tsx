import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export default function SegmentedControl({ segments, selectedIndex, onChange }: SegmentedControlProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    const segWidth = widthRef.current / segments.length;
    translateX.setValue(selectedIndex * segWidth);
  };

  useEffect(() => {
    if (widthRef.current > 0) {
      const segWidth = widthRef.current / segments.length;
      Animated.spring(translateX, {
        toValue: selectedIndex * segWidth,
        useNativeDriver: true,
        tension: 120,
        friction: 14,
      }).start();
    }
  }, [selectedIndex, segments.length]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.indicator,
          {
            width: `${100 / segments.length}%` as unknown as number,
            transform: [{ translateX }],
          },
        ]}
      />
      {segments.map((seg, i) => (
        <TouchableOpacity
          key={seg}
          style={styles.segment}
          onPress={() => onChange(i)}
          activeOpacity={0.7}
          testID={`segment-${seg}`}
        >
          <Text style={[styles.text, selectedIndex === i && styles.activeText]}>{seg}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.full,
    padding: 3,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.full,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  activeText: {
    color: Colors.textPrimary,
  },
});
