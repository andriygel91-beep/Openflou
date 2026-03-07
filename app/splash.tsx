// Openflou Elegant Splash Screen Animation
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

export default function SplashScreen() {
  const router = useRouter();

  // Wave animation
  const wave1Scale = useSharedValue(0.8);
  const wave1Opacity = useSharedValue(0);
  const wave2Scale = useSharedValue(0.8);
  const wave2Opacity = useSharedValue(0);
  const wave3Scale = useSharedValue(0.8);
  const wave3Opacity = useSharedValue(0);

  // Logo animation
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const logoY = useSharedValue(-30);

  // Text animation
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);

  // Tagline animation
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    startAnimation();
  }, []);

  function navigateToAuth() {
    router.replace('/auth');
  }

  function startAnimation() {
    // 1. Waves expand
    wave1Opacity.value = withTiming(0.15, { duration: 400 });
    wave1Scale.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
    
    wave2Opacity.value = withDelay(300, withTiming(0.1, { duration: 400 }));
    wave2Scale.value = withDelay(300, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    
    wave3Opacity.value = withDelay(600, withTiming(0.08, { duration: 400 }));
    wave3Scale.value = withDelay(600, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));

    // 2. Logo appears with smooth spring
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    logoY.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 90 }));
    logoScale.value = withDelay(400, withSpring(1, { damping: 10, stiffness: 100 }));

    // 3. Text fades in
    textOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    textY.value = withDelay(1000, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // 4. Tagline fades in
    taglineOpacity.value = withDelay(1400, withTiming(1, { duration: 600 }));

    // 5. Navigate after animation
    setTimeout(navigateToAuth, 3000);
  }

  const wave1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wave1Scale.value }],
    opacity: wave1Opacity.value,
  }));

  const wave2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wave2Scale.value }],
    opacity: wave2Opacity.value,
  }));

  const wave3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wave3Scale.value }],
    opacity: wave3Opacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoY.value },
      { scale: logoScale.value },
    ],
    opacity: logoOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textY.value }],
    opacity: textOpacity.value,
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0F1628', '#1A2747', '#25406E']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Elegant Waves */}
      <Animated.View style={[styles.wave, wave1AnimatedStyle]}>
        <View style={[styles.waveCircle, { width: 280, height: 280, borderRadius: 140 }]} />
      </Animated.View>
      
      <Animated.View style={[styles.wave, wave2AnimatedStyle]}>
        <View style={[styles.waveCircle, { width: 420, height: 420, borderRadius: 210 }]} />
      </Animated.View>
      
      <Animated.View style={[styles.wave, wave3AnimatedStyle]}>
        <View style={[styles.waveCircle, { width: 560, height: 560, borderRadius: 280 }]} />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </Animated.View>

        <Animated.View style={textAnimatedStyle}>
          <Text style={styles.appName}>Openflou</Text>
        </Animated.View>

        <Animated.View style={taglineAnimatedStyle}>
          <Text style={styles.tagline}>Secure P2P Messenger</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wave: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveCircle: {
    borderWidth: 2,
    borderColor: 'rgba(100, 150, 255, 0.3)',
    backgroundColor: 'rgba(100, 150, 255, 0.05)',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 28,
  },
  logo: {
    width: 140,
    height: 140,
  },
  appName: {
    fontSize: 46,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 12,
    includeFontPadding: false,
    letterSpacing: 1,
  },
});
