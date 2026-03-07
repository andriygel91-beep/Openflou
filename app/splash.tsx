// Openflou Premium Splash Screen
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

export default function SplashScreen() {
  const router = useRouter();

  // Ripple animations (3 concentric circles)
  const ripple1Scale = useSharedValue(0);
  const ripple1Opacity = useSharedValue(0);
  const ripple2Scale = useSharedValue(0);
  const ripple2Opacity = useSharedValue(0);
  const ripple3Scale = useSharedValue(0);
  const ripple3Opacity = useSharedValue(0);

  // Logo animation
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(0);

  // Text animations
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(15);

  useEffect(() => {
    startAnimation();
  }, []);

  function startAnimation() {
    // 1. Ripple waves expand outward
    ripple1Opacity.value = withTiming(1, { duration: 300 });
    ripple1Scale.value = withSequence(
      withTiming(1.2, { duration: 1200, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 0 })
    );
    ripple1Opacity.value = withDelay(
      1000,
      withTiming(0, { duration: 200 })
    );

    ripple2Opacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    ripple2Scale.value = withDelay(
      200,
      withSequence(
        withTiming(1.2, { duration: 1200, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      )
    );
    ripple2Opacity.value = withDelay(
      1200,
      withTiming(0, { duration: 200 })
    );

    ripple3Opacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    ripple3Scale.value = withDelay(
      400,
      withSequence(
        withTiming(1.2, { duration: 1200, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      )
    );
    ripple3Opacity.value = withDelay(
      1400,
      withTiming(0, { duration: 200 })
    );

    // 2. Logo appears with bounce + subtle rotation
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    logoScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 8,
        stiffness: 80,
        mass: 0.5,
      })
    );
    logoRotate.value = withDelay(
      200,
      withSequence(
        withTiming(3, { duration: 400, easing: Easing.out(Easing.back(1.2)) }),
        withTiming(0, { duration: 200 })
      )
    );

    // 3. App name appears with scale
    textOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    textScale.value = withDelay(
      900,
      withSpring(1, { damping: 10, stiffness: 100 })
    );

    // 4. Tagline slides up
    taglineOpacity.value = withDelay(1300, withTiming(1, { duration: 600 }));
    taglineY.value = withDelay(
      1300,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );

    // 5. Navigate to auth
    setTimeout(() => router.replace('/auth'), 2800);
  }

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple1Scale.value }],
    opacity: ripple1Opacity.value,
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple2Scale.value }],
    opacity: ripple2Opacity.value,
  }));

  const ripple3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple3Scale.value }],
    opacity: ripple3Opacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textScale.value }],
    opacity: textOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: taglineY.value }],
    opacity: taglineOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0A1628', '#1E3A5F', '#2B5086']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Ripple waves */}
      <Animated.View style={[styles.ripple, ripple1Style]}>
        <View style={[styles.rippleCircle, { width: 240, height: 240 }]} />
      </Animated.View>

      <Animated.View style={[styles.ripple, ripple2Style]}>
        <View style={[styles.rippleCircle, { width: 360, height: 360 }]} />
      </Animated.View>

      <Animated.View style={[styles.ripple, ripple3Style]}>
        <View style={[styles.rippleCircle, { width: 480, height: 480 }]} />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View style={logoStyle}>
          <View style={styles.logoGlow}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={200}
            />
          </View>
        </Animated.View>

        <Animated.View style={textStyle}>
          <Text style={styles.appName}>Openflou</Text>
        </Animated.View>

        <Animated.View style={taglineStyle}>
          <Text style={styles.tagline}>Secure Messenger</Text>
        </Animated.View>
      </View>

      {/* Bottom accent line */}
      <View style={styles.accentLine} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCircle: {
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: 'rgba(100, 180, 255, 0.4)',
    backgroundColor: 'rgba(100, 180, 255, 0.08)',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoGlow: {
    shadowColor: '#64B4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  logo: {
    width: 130,
    height: 130,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    includeFontPadding: false,
    letterSpacing: 3,
    marginTop: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 10,
    includeFontPadding: false,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(100, 180, 255, 0.5)',
  },
});
