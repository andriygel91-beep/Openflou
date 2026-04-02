// Openflou Splash Screen - Wave Animation
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

// Animated ring component
function Ring({ delay, size, color }: { delay: number; size: number; color: string }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.6, { duration: 400 }));
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) }),
          withTiming(0.3, { duration: 0 })
        ),
        -1
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 400 }),
          withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export default function SplashScreen() {
  const router = useRouter();

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const dotsProgress = useSharedValue(0);
  const gradientShift = useSharedValue(0);

  useEffect(() => {
    startAnimation();
  }, []);

  function startAnimation() {
    // Background gradient animation
    gradientShift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    // Logo pop
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(
      400,
      withSpring(1, { damping: 10, stiffness: 120 })
    );

    // App name slide up
    textOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    textY.value = withDelay(
      900,
      withSpring(0, { damping: 14, stiffness: 100 })
    );

    // Tagline fade
    taglineOpacity.value = withDelay(1400, withTiming(1, { duration: 600 }));

    // Loading dots
    dotsProgress.value = withDelay(
      1600,
      withRepeat(
        withTiming(3, { duration: 900, easing: Easing.linear }),
        -1
      )
    );

    setTimeout(() => router.replace('/auth'), 3000);
  }

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textY.value }],
    opacity: textOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: interpolate(dotsProgress.value, [0, 0.5, 1, 1.5], [0.3, 1, 0.3, 0.3]),
    transform: [{ scale: interpolate(dotsProgress.value, [0, 0.5, 1, 1.5], [0.8, 1.2, 0.8, 0.8]) }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: interpolate(dotsProgress.value, [0.5, 1, 1.5, 2], [0.3, 1, 0.3, 0.3]),
    transform: [{ scale: interpolate(dotsProgress.value, [0.5, 1, 1.5, 2], [0.8, 1.2, 0.8, 0.8]) }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: interpolate(dotsProgress.value, [1, 1.5, 2, 2.5], [0.3, 1, 0.3, 0.3]),
    transform: [{ scale: interpolate(dotsProgress.value, [1, 1.5, 2, 2.5], [0.8, 1.2, 0.8, 0.8]) }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#080818', '#12124A', '#0E2A5C']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Ripple rings centered on logo */}
      <View style={styles.ringsContainer}>
        <Ring delay={0} size={160} color="rgba(100, 160, 255, 0.6)" />
        <Ring delay={600} size={260} color="rgba(100, 160, 255, 0.4)" />
        <Ring delay={1200} size={360} color="rgba(100, 160, 255, 0.25)" />
        <Ring delay={1800} size={460} color="rgba(100, 160, 255, 0.15)" />
      </View>

      {/* Logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <View style={styles.logoGlow}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.appName, textStyle]}>
        Openflou
      </Animated.Text>

      {/* Tagline */}
      <Animated.View style={[styles.taglineRow, taglineStyle]}>
        <Text style={styles.tagline}>Private · Secure · Free</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(8, 8, 24, 0.7)']}
        style={styles.bottomGradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringsContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    marginBottom: 32,
  },
  logoGlow: {
    shadowColor: '#4A90F0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
    letterSpacing: 2,
    textShadowColor: 'rgba(74, 144, 240, 0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  taglineRow: {
    marginTop: 12,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(150, 190, 255, 0.85)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 64,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A90F0',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
});
