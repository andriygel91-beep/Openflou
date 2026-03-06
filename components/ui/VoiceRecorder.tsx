// Openflou Voice Recorder Component
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface VoiceRecorderProps {
  colors: any;
  t: any;
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ colors, t, onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < -50) {
          handleCancel();
        }
      },
    })
  ).current;

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri && duration > 0) {
        onSend(uri, duration);
      }
      
      recordingRef.current = null;
      setDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }

  async function handleCancel() {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      setDuration(0);
      onCancel();
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <Pressable
        onPressIn={startRecording}
        style={({ pressed }) => [
          styles.micButton,
          {
            backgroundColor: colors.surfaceSecondary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <MaterialIcons name="mic" size={24} color={colors.icon} />
      </Pressable>
    );
  }

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.recordingContainer, { backgroundColor: colors.background }]}
    >
      <View style={styles.recordingContent}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <MaterialIcons name="close" size={24} color={colors.error} />
        </Pressable>

        <View style={[styles.recordingIndicator, { backgroundColor: colors.error }]} />
        
        <Text style={[styles.recordingText, { color: colors.error }]}>{t.recording}</Text>
        
        <Text style={[styles.durationText, { color: colors.text }]}>{formatDuration(duration)}</Text>

        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  backgroundColor: colors.primary,
                  height: Math.random() * 24 + 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Pressable
        onPress={stopRecording}
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <MaterialIcons name="send" size={20} color={colors.textInverted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    padding: 8,
    borderRadius: 20,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    padding: 8,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    includeFontPadding: false,
  },
  durationText: {
    fontSize: 14,
    marginLeft: 12,
    includeFontPadding: false,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 2,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
