import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftRight, MapPin, X, Navigation } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import Colors from "../constants/colors";
import { Delivery } from "../types/models";
import { getDistanceFromAddresses, removeCoordinatesFromAddress } from "../utils/distanceCalculator";

const extractCashPaymentFromNotes = (notes: string): string | null => {
  if (!notes) return null;
  const cashMatch = notes.match(/תשלום במזומן[:\s]*₪?([\d,]+)/i);
  if (cashMatch && cashMatch[1]) {
    return cashMatch[1].replace(/,/g, "");
  }
  if (notes.includes("תשלום במזומן")) {
    return "";
  }
  return null;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

type NewDeliveryFullScreenPopupProps = {
  visible: boolean;
  delivery: Delivery | null;
  businessName?: string;
  onAccept: () => Promise<void> | void;
  onReject: () => void;
  disabled?: boolean;
};

export function NewDeliveryFullScreenPopup({
  visible,
  delivery,
  businessName,
  onAccept,
  onReject,
  disabled = false,
}: NewDeliveryFullScreenPopupProps) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isActuallyVisible, setIsActuallyVisible] = useState<boolean>(false);

  const aerialDistance = useMemo(() => {
    if (!delivery) {
      return null;
    }
    if (typeof delivery.distanceKm === "number") {
      return delivery.distanceKm;
    }
    const fallback = getDistanceFromAddresses(delivery.pickupAddress, delivery.dropoffAddress);
    return fallback ?? null;
  }, [delivery]);

  useEffect(() => {
    if (visible && delivery) {
      setIsActuallyVisible(true);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsActuallyVisible(false);
      });
    }
  }, [visible, delivery, scale, opacity]);

  const handleAccept = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    await onAccept();
  }, [onAccept]);

  const handleReject = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
        console.log("Reject haptic failed", error);
      });
    }
    onReject();
  }, [onReject]);

  if (!isActuallyVisible || !delivery) {
    return null;
  }

  return (
    <Modal
      visible={isActuallyVisible}
      transparent
      animationType="none"
      onRequestClose={handleReject}
      statusBarTranslucent
      testID="new-delivery-fullscreen-popup"
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.popup,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable
              onPress={handleReject}
              style={styles.closeButton}
              disabled={disabled}
              testID="close-fullscreen-popup"
            >
              <View style={styles.closeCircle}>
                <X size={24} color={Colors.light.text} />
              </View>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.alertContainer}>
              <Text style={styles.alertEmoji}>🔔</Text>
              <Text style={styles.alertTitle}>משלוח חדש במערכת!</Text>
              {businessName ? (
                <Text style={styles.businessName}>{businessName}</Text>
              ) : null}
            </View>

            <View style={styles.content}>
              <View style={styles.deliveryInfo}>
                <Text style={styles.deliveryId}>משלוח #{delivery.id.slice(-4)}</Text>
                {aerialDistance !== null && (
                  <View style={styles.distanceContainer}>
                    <Navigation size={18} color={Colors.light.tint} />
                    <Text style={styles.distanceText}>{aerialDistance} ק&quot;מ</Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.row}>
                  <MapPin size={22} color={Colors.light.tintDark} />
                  <View style={styles.rowContent}>
                    <Text style={styles.label}>כתובת איסוף</Text>
                    <Text style={styles.value}>
                      {removeCoordinatesFromAddress(delivery.pickupAddress)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <ArrowLeftRight size={22} color={Colors.light.tintDark} />
                  <View style={styles.rowContent}>
                    <Text style={styles.label}>כתובת יעד</Text>
                    <Text style={styles.value}>
                      {removeCoordinatesFromAddress(delivery.dropoffAddress)}
                    </Text>
                  </View>
                </View>
              </View>

              {extractCashPaymentFromNotes(delivery.notes) !== null ? (
                <View style={styles.cashPaymentSection}>
                  <Text style={styles.cashPaymentText}>
                    {extractCashPaymentFromNotes(delivery.notes) 
                      ? `תשלום במזומן: ₪${extractCashPaymentFromNotes(delivery.notes)}`
                      : "תשלום במזומן"}
                  </Text>
                </View>
              ) : null}

              {delivery.notes && !delivery.payment ? (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>הערות</Text>
                  <Text style={styles.notesText}>{delivery.notes}</Text>
                </View>
              ) : null}

              {delivery.preparationTimeMinutes ? (
                <View style={styles.prepTimeCard}>
                  <Text style={styles.prepTimeLabel}>זמן הכנה מינימלי</Text>
                  <Text style={styles.prepTimeValue}>
                    {delivery.preparationTimeMinutes} דקות
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={handleReject}
              style={[styles.rejectButton, disabled && styles.disabledButton]}
              disabled={disabled}
              testID="reject-delivery-button"
            >
              <Text style={[styles.rejectText, disabled && styles.disabledText]}>
                סרב
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAccept}
              style={[styles.acceptButton, disabled && styles.disabledButton]}
              disabled={disabled}
              testID="accept-delivery-button"
            >
              <Text style={styles.acceptText}>קבל משלוח</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  popup: {
    position: "absolute" as const,
    width: SCREEN_WIDTH - 32,
    maxWidth: 500,
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: Colors.light.background,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  alertContainer: {
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  alertEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "center",
  },
  businessName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "rtl",
    textAlign: "center",
  },
  content: {
    gap: 20,
  },
  deliveryInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  deliveryId: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  distanceContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 122, 255, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  section: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  rowContent: {
    flex: 1,
    alignItems: "flex-end",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  value: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.text,
    writingDirection: "rtl",
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: -20,
    marginVertical: -4,
  },
  cashPaymentSection: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },
  cashPaymentText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16a34a",
    writingDirection: "rtl",
  },
  notesSection: {
    backgroundColor: "rgba(255, 149, 0, 0.08)",
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 149, 0, 0.2)",
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ff9500",
    writingDirection: "rtl",
    textAlign: "right",
  },
  notesText: {
    fontSize: 16,
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
    lineHeight: 24,
  },
  prepTimeCard: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 20,
    padding: 18,
    alignItems: "flex-end",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  prepTimeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  prepTimeValue: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 20,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 24,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: Colors.light.border,
  },
});
