// Openflou Reaction Picker Component
import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { BlurView } from 'expo-blur';

interface ReactionPickerProps {
  visible: boolean;
  colors: any;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export function ReactionPicker({ visible, colors, onSelect, onClose, theme }: ReactionPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView
          intensity={20}
          tint={theme}
          style={styles.blurContainer}
        >
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface }]}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  onSelect(emoji);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.emojiButton,
                  {
                    backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  },
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickerContainer: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 16,
    gap: 4,
  },
  emojiButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  emoji: {
    fontSize: 28,
  },
});
