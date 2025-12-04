import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "../constants/colors";
import { useDelivery } from "../providers/DeliveryProvider";

const animationDuration = 220;
const autoDismissDelay = 3600;

export function BusinessCreationToast() {
  const {
    businessCreationMessage,
    clearBusinessCreationMessage,
    courierAssignmentMessage,
    clearCourierAssignmentMessage,
    user,
  } = useDelivery();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-18)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toastMessage = useMemo(() => {
    if (user?.role === "business") {
      return businessCreationMessage;
    }
    if (user?.role === "courier") {
      return courierAssignmentMessage;
    }
    return null;
  }, [businessCreationMessage, courierAssignmentMessage, user?.role]);

  const clearToastMessage = useMemo(() => {
    if (user?.role === "business") {
      return clearBusinessCreationMessage;
    }
    if (user?.role === "courier") {
      return clearCourierAssignmentMessage;
    }
    return null;
  }, [clearBusinessCreationMessage, clearCourierAssignmentMessage, user?.role]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -18,
        duration: animationDuration,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && clearToastMessage) {
        clearToastMessage();
      }
    });
  }, [clearToastMessage, clearTimer, opacity, translateY]);

  useEffect(() => {
    if (!toastMessage || !clearToastMessage) {
      clearTimer();
      opacity.setValue(0);
      translateY.setValue(-18);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(-18);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: animationDuration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }),
    ]).start();

    clearTimer();
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, autoDismissDelay);

    return () => {
      clearTimer();
    };
  }, [clearTimer, clearToastMessage, hideToast, opacity, toastMessage, translateY]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top + 12,
        opacity,
        transform: [{ translateY }],
      },
    ],
    [insets.top, opacity, translateY],
  );

  if (!toastMessage || !clearToastMessage) {
    return null;
  }

  return (
    <Animated.View style={containerStyle} pointerEvents="box-none" testID="business-creation-toast">
      <Pressable onPress={hideToast} style={styles.pressable} testID="business-creation-toast-dismiss">
        <View style={styles.glow} />
        <View style={styles.content}>
          <Text style={styles.message}>{toastMessage}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    zIndex: 1400,
  },
  pressable: {
    width: "100%",
  },
  glow: {
    position: "absolute" as const,
    left: 18,
    right: 18,
    top: 10,
    bottom: 2,
    borderRadius: 26,
    backgroundColor: "rgba(34, 197, 94, 0.28)",
    shadowColor: "rgba(34, 197, 94, 0.6)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
  },
  content: {
    backgroundColor: Colors.light.surface,
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 20,
  },
  message: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "800" as const,
    color: Colors.light.text,
    textAlign: "center" as const,
    writingDirection: "rtl" as const,
  },
});
