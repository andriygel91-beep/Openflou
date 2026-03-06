// Openflou Empty State Component
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  colors: any;
}

export function EmptyState({ icon, title, description, colors }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name={icon} size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {description && <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  description: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
