// Openflou Splash Screen with Spiral Animation
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors } = useOpenFlou();
  const router = useRouter();

  // Spiral animation values
  const spiralRotation = useSharedValue(0);
  const spiralScale = useSharedValue(0);
  const spiralOpacity = useSharedValue(1);

  // Logo animation values
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);

  // Letter animation values
  const letterTranslateY = useSharedValue(50);
  const letterOpacity = useSharedValue(0);

  // Button animations
  const button1TranslateY = useSharedValue(-100);
  const button1Opacity = useSharedValue(0);
  const button2TranslateY = useSharedValue(-100);
  const button2Opacity = useSharedValue(0);

  useEffect(() => {
    startAnimation();
  }, []);

  function navigateToAuth() {
    router.replace('/auth');
  }

  function startAnimation() {
    // 1. Spiral expands and rotates
    spiralRotation.value = withTiming(720, {
      duration: 1200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    
    spiralScale.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.exp),
    });

    // 2. Logo appears
    logoScale.value = withDelay(
      400,
      withSpring(1, {
        damping: 12,
        stiffness: 100,
      })
    );
    
    logoOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 300 })
    );

    // 3. Letters appear
    letterTranslateY.value = withDelay(
      800,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );
    
    letterOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 400 })
    );

    // 4. Spiral fades out
    spiralOpacity.value = withDelay(
      1200,
      withTiming(0, { duration: 400 })
    );

    // 5. Buttons fall down
    button1TranslateY.value = withDelay(
      1400,
      withSequence(
        withSpring(0, {
          damping: 10,
          stiffness: 80,
        })
      )
    );
    
    button1Opacity.value = withDelay(
      1400,
      withTiming(1, { duration: 300 })
    );

    button2TranslateY.value = withDelay(
      1600,
      withSequence(
        withSpring(0, {
          damping: 10,
          stiffness: 80,
        })
      )
    );
    
    button2Opacity.value = withDelay(
      1600,
      withTiming(1, { duration: 300 }, () => {
        // Animation complete - navigate after 1 second
        runOnJS(setTimeout)(navigateToAuth, 1000);
      })
    );
  }

  const spiralAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spiralRotation.value}deg` },
      { scale: spiralScale.value },
    ],
    opacity: spiralOpacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const letterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: letterTranslateY.value }],
    opacity: letterOpacity.value,
  }));

  const button1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: button1TranslateY.value }],
    opacity: button1Opacity.value,
  }));

  const button2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: button2TranslateY.value }],
    opacity: button2Opacity.value,
  }));

  return (
    <LinearGradient
      colors={[colors.primary, colors.background]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Spiral Background */}
      <Animated.View style={[styles.spiralContainer, spiralAnimatedStyle]}>
        <View style={styles.spiral}>
          {[0, 1, 2, 3, 4].map((index) => (
            <View
              key={index}
              style={[
                styles.spiralRing,
                {
                  width: 100 + index * 80,
                  height: 100 + index * 80,
                  borderRadius: (100 + index * 80) / 2,
                  borderColor: `rgba(255, 255, 255, ${0.3 - index * 0.05})`,
                  borderWidth: 3 - index * 0.3,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Logo */}
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
            <MaterialIcons name="forum" size={80} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* App Name */}
        <Animated.View style={[styles.nameContainer, letterAnimatedStyle]}>
          <Text style={styles.appName}>Openflou</Text>
          <Text style={styles.tagline}>Secure P2P Messenger</Text>
        </Animated.View>

        {/* Falling Buttons */}
        <View style={styles.buttonsContainer}>
          <Animated.View style={[styles.button, button1AnimatedStyle]}>
            <View style={[styles.buttonInner, { backgroundColor: '#FFFFFF' }]}>
              <MaterialIcons name="login" size={24} color={colors.primary} />
              <Text style={[styles.buttonText, { color: colors.primary }]}>Sign In</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.button, button2AnimatedStyle]}>
            <View style={[styles.buttonInner, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <MaterialIcons name="person-add" size={24} color="#FFFFFF" />
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Create Account</Text>
            </View>
          </Animated.View>
        </View>
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
  spiralContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spiral: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spiralRing: {
    position: 'absolute',
    borderStyle: 'solid',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    includeFontPadding: false,
  },
  buttonsContainer: {
    width: width - 48,
    gap: 16,
  },
  button: {
    width: '100%',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
