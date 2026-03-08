// Openflou Premium Splash Screen - Particle Animation
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
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');
const PARTICLES = Array.from({ length: 20 }, (_, i) => i);

// Particle component
function Particle({ index, colors }: { index: number; colors: any }) {
  const size = Math.random() * 4 + 2;
  const startX = Math.random() * width;
  const startY = Math.random() * height;
  
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const delay = Math.random() * 800;
    const endX = startX + (Math.random() - 0.5) * 200;
    const endY = startY - Math.random() * 400 - 200;
    
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 10 }));
    
    translateX.value = withDelay(
      delay + 400,
      withTiming(endX, { duration: 2000, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay + 400,
      withTiming(endY, { duration: 2000, easing: Easing.out(Easing.quad) })
    );
    
    opacity.value = withDelay(
      delay + 1800,
      withTiming(0, { duration: 600 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          backgroundColor: colors.primary,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function SplashScreen() {
  const router = useRouter();

  // Logo animation
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-180);
  const logoGlow = useSharedValue(0);

  // Text animations
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);
  const textLetterSpacing = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(30);
  
  // Background pulse
  const bgPulse = useSharedValue(1);

  useEffect(() => {
    startAnimation();
  }, []);

  function startAnimation() {
    // Background pulse
    bgPulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    // Logo rotation + scale + glow
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    logoScale.value = withDelay(
      300,
      withSpring(1, {
        damping: 12,
        stiffness: 100,
      })
    );
    logoRotate.value = withDelay(
      300,
      withSpring(0, {
        damping: 15,
        stiffness: 80,
      })
    );
    logoGlow.value = withDelay(
      600,
      withSequence(
        withTiming(1, { duration: 600 }),
        withRepeat(
          withSequence(
            withTiming(0.7, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
          ),
          3
        )
      )
    );

    // Text with letter spacing effect
    textOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));
    textScale.value = withDelay(
      1000,
      withSpring(1, { damping: 12, stiffness: 120 })
    );
    textLetterSpacing.value = withDelay(
      1000,
      withTiming(3, { duration: 800, easing: Easing.out(Easing.exp) })
    );

    // Tagline
    taglineOpacity.value = withDelay(1500, withTiming(1, { duration: 600 }));
    taglineY.value = withDelay(
      1500,
      withSpring(0, { damping: 15, stiffness: 120 })
    );

    // Navigate
    setTimeout(() => router.replace('/auth'), 3200);
  }

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgPulse.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
    opacity: logoOpacity.value,
  }));

  const logoGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.6 * logoGlow.value,
    shadowRadius: 40 * logoGlow.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textScale.value }],
    opacity: textOpacity.value,
    letterSpacing: textLetterSpacing.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: taglineY.value }],
    opacity: taglineOpacity.value,
  }));

  const particleColors = {
    primary: '#64B4FF',
  };

  return (
    <Animated.View style={[styles.container, bgStyle]}>
      <LinearGradient
        colors={['#0D0D2B', '#1A1A3E', '#252556']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Floating particles */}
      {PARTICLES.map((i) => (
        <Particle key={i} index={i} colors={particleColors} />
      ))}

      {/* Content */}
      <View style={styles.content}>
        <Animated.View style={[logoStyle, logoGlowStyle, styles.logoContainer]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </Animated.View>

        <Animated.Text style={[styles.appName, textStyle]}>
          Openflou
        </Animated.Text>

        <Animated.View style={taglineStyle}>
          <Text style={styles.tagline}>Private · Secure · Free</Text>
        </Animated.View>
      </View>

      {/* Gradient bottom overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(13, 13, 43, 0.8)']}
        style={styles.bottomGradient}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    borderRadius: 100,
    shadowColor: '#64B4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    shadowColor: '#64B4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 25,
  },
  logo: {
    width: 140,
    height: 140,
  },
  appName: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    includeFontPadding: false,
    marginTop: 28,
    textShadowColor: 'rgba(100, 180, 255, 0.5)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(100, 180, 255, 0.9)',
    marginTop: 12,
    includeFontPadding: false,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
});
