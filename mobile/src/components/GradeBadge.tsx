import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GRADE_COLORS: Record<string, string> = {
  Mint: '#10b981',
  NM: '#34d399',
  LP: '#fbbf24',
  MP: '#f97316',
  HP: '#ef4444',
  Damaged: '#7f1d1d',
};

interface Props {
  grade: string | null;
  confidence?: number;
  small?: boolean;
}

export function GradeBadge({ grade, confidence, small }: Props) {
  if (!grade) {
    return (
      <View style={[styles.badge, styles.unknown, small && styles.small]}>
        <Text style={[styles.text, small && styles.smallText]}>?</Text>
      </View>
    );
  }
  const bg = GRADE_COLORS[grade] ?? '#6b7280';
  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.text, small && styles.smallText]}>{grade}</Text>
      {confidence !== undefined && !small && (
        <Text style={styles.confidence}>{Math.round(confidence * 100)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unknown: {
    backgroundColor: '#6b7280',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  smallText: {
    fontSize: 11,
  },
  confidence: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 1,
  },
});
