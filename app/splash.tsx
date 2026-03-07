// Openflou Elegant Splash Screen Animation
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Circle animation values
  const circle1Scale = useSharedValue(0);
  const circle2Scale = useSharedValue(0);
  const circle3Scale = useSharedValue(0);
  const circle1Opacity = useSharedValue(0.6);
  const circle2Opacity = useSharedValue(0.4);
  const circle3Opacity = useSharedValue(0.2);

  // Logo animation
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(0);

  // Text animation
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  // Tagline animation
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    startAnimation();
  }, []);

  function navigateToAuth() {
    router.replace('/auth');
  }

  function startAnimation() {
    // 1. Ripple circles
    circle1Scale.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    
    circle2Scale.value = withDelay(
      200,
      withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );
    
    circle3Scale.value = withDelay(
      400,
      withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );

    // 2. Fade out circles
    circle1Opacity.value = withDelay(1000, withTiming(0, { duration: 400 }));
    circle2Opacity.value = withDelay(1000, withTiming(0, { duration: 400 }));
    circle3Opacity.value = withDelay(1000, withTiming(0, { duration: 400 }));

    // 3. Logo appears with gentle rotation
    logoScale.value = withDelay(
      600,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.back(1.1)),
      })
    );
    
    logoOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
    
    logoRotate.value = withDelay(
      600,
      withSequence(
        withTiming(-5, { duration: 400 }),
        withTiming(5, { duration: 400 }),
        withTiming(0, { duration: 400 })
      )
    );

    // 4. Text appears
    textOpacity.value = withDelay(1200, withTiming(1, { duration: 600 }));
    textTranslateY.value = withDelay(
      1200,
      withTiming(0, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      })
    );

    // 5. Tagline appears
    taglineOpacity.value = withDelay(1600, withTiming(1, { duration: 600 }));

    // 6. Navigate after animation
    setTimeout(navigateToAuth, 2800);
  }

  const circle1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circle1Scale.value }],
    opacity: circle1Opacity.value,
  }));

  const circle2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circle2Scale.value }],
    opacity: circle2Opacity.value,
  }));

  const circle3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circle3Scale.value }],
    opacity: circle3Opacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
    opacity: logoOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textTranslateY.value }],
    opacity: textOpacity.value,
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#1A1F3A', '#2C3E70', '#3A5A9A']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Smooth Ripple Circles */}
      <Animated.View style={[styles.circleContainer, circle1AnimatedStyle]}>
        <View style={[styles.circle, { width: 200, height: 200, borderRadius: 100, borderColor: 'rgba(255, 255, 255, 0.3)' }]} />
      </Animated.View>
      
      <Animated.View style={[styles.circleContainer, circle2AnimatedStyle]}>
        <View style={[styles.circle, { width: 320, height: 320, borderRadius: 160, borderColor: 'rgba(255, 255, 255, 0.2)' }]} />
      </Animated.View>
      
      <Animated.View style={[styles.circleContainer, circle3AnimatedStyle]}>
        <View style={[styles.circle, { width: 440, height: 440, borderRadius: 220, borderColor: 'rgba(255, 255, 255, 0.1)' }]} />
      </Animated.View>

      {/* Logo */}
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="forum" size={64} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* App Name */}
        <Animated.View style={textAnimatedStyle}>
          <Text style={styles.appName}>Openflou</Text>
        </Animated.View>

        {/* Tagline */}
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
  circleContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 8,
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
});
