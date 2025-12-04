import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftRight, MapPin, X, Navigation } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import Colors from "../constants/colors";
import { Delivery } from "../types/models";
import { removeCoordinatesFromAddress } from "../utils/distanceCalculator";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

type NewDeliveryBottomSheetProps = {
  visible: boolean;
  delivery: Delivery | null;
  businessName?: string;
  onAccept: () => Promise<void> | void;
  onReject: () => void;
  disabled?: boolean;
};

export function NewDeliveryBottomSheet({
  visible,
  delivery,
  businessName,
  onAccept,
  onReject,
  disabled = false,
}: NewDeliveryBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isActuallyVisible, setIsActuallyVisible] = useState<boolean>(false);

  const aerialDistance = delivery?.distanceKm ?? null;

  useEffect(() => {
    if (visible && delivery) {
      setIsActuallyVisible(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsActuallyVisible(false);
      });
    }
  }, [visible, delivery, translateY, overlayOpacity]);

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
      testID="new-delivery-bottom-sheet"
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleReject} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Pressable
              onPress={handleReject}
              style={styles.closeButton}
              disabled={disabled}
              testID="close-bottom-sheet"
            >
              <X size={24} color={Colors.light.secondaryText} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>משלוח חדש במערכת! 🔔</Text>
              {businessName ? (
                <Text style={styles.headerSubtitle}>{businessName}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryId}>משלוח #{delivery.id.slice(-4)}</Text>
              {aerialDistance !== null && (
                <View style={styles.distanceContainer}>
                  <Navigation size={16} color={Colors.light.tint} />
                  <Text style={styles.distanceText}>{aerialDistance} ק&quot;מ</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.row}>
                <MapPin size={20} color={Colors.light.tintDark} />
                <View style={styles.rowContent}>
                  <Text style={styles.label}>כתובת איסוף</Text>
                  <Text style={styles.value} numberOfLines={2}>
                    {removeCoordinatesFromAddress(delivery.pickupAddress)}
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <ArrowLeftRight size={20} color={Colors.light.tintDark} />
                <View style={styles.rowContent}>
                  <Text style={styles.label}>כתובת יעד</Text>
                  <Text style={styles.value} numberOfLines={2}>
                    {removeCoordinatesFromAddress(delivery.dropoffAddress)}
                  </Text>
                </View>
              </View>
            </View>

            {delivery.notes ? (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>הערות</Text>
                <Text style={styles.notesText} numberOfLines={3}>
                  {delivery.notes}
                </Text>
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
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: SHEET_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  closeButton: {
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
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
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  distanceContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  section: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  rowContent: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  notesSection: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
    textAlign: "right",
  },
  notesText: {
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
    lineHeight: 22,
  },
  prepTimeCard: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-end",
    gap: 4,
  },
  prepTimeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  prepTimeValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 24,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    fontSize: 17,
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
