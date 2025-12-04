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
import { Bike, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import Colors from "../constants/colors";
import { Delivery } from "../types/models";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

type CourierAssignedBottomSheetProps = {
  visible: boolean;
  delivery: Delivery | null;
  courierName?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
};

export function CourierAssignedBottomSheet({
  visible,
  delivery,
  courierName,
  onConfirm,
  disabled = false,
}: CourierAssignedBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isActuallyVisible, setIsActuallyVisible] = useState<boolean>(false);

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleConfirm = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    await onConfirm();
  }, [onConfirm]);

  if (!isActuallyVisible || !delivery) {
    return null;
  }

  return (
    <Modal
      visible={isActuallyVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      testID="courier-assigned-bottom-sheet"
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
        />

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
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>שליח תפס את המשלוח! 🎉</Text>
              <Text style={styles.headerSubtitle}>משלוח #{delivery.id.slice(-4)}</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.courierCard}>
              <View style={styles.courierIcon}>
                <Bike size={28} color={Colors.light.tint} />
              </View>
              <View style={styles.courierInfo}>
                <Text style={styles.courierLabel}>שם השליח</Text>
                <Text style={styles.courierName}>{courierName || "לא ידוע"}</Text>
              </View>
            </View>

            {delivery.estimatedArrivalMinutes ? (
              <View style={styles.timeCard}>
                <Clock size={24} color={Colors.light.taken} />
                <View style={styles.timeInfo}>
                  <Text style={styles.timeLabel}>זמן הגעה משוער</Text>
                  <Text style={styles.timeValue}>
                    {delivery.estimatedArrivalMinutes} דקות
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                השליח בדרך אליכם. אנא אשרו את הקבלה והתחילו בהכנת ההזמנה.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmButton, disabled && styles.disabledButton]}
            disabled={disabled}
            testID="confirm-and-start-button"
          >
            <Text style={styles.confirmText}>אשר והתחל בהכנה</Text>
          </Pressable>
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
    alignItems: "center",
    marginBottom: 28,
  },
  headerTextContainer: {
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  content: {
    gap: 20,
  },
  courierCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  courierIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  courierInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  courierLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  courierName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  timeCard: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
  },
  timeInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  infoBox: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoText: {
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "center",
    lineHeight: 22,
  },
  confirmButton: {
    paddingVertical: 18,
    borderRadius: 24,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  confirmText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
