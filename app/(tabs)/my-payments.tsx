import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

import Colors from "../../constants/colors";
import { useDelivery } from "../../providers/DeliveryProvider";
import { Delivery, User } from "../../types/models";
import { TimeSelectionModal } from "../../components/TimeSelectionModal";
import { NewDeliveryFullScreenPopup } from "../../components/NewDeliveryFullScreenPopup";
import { CourierAssignedBottomSheet } from "../../components/CourierAssignedBottomSheet";

type TimeFilter = "daily" | "weekly" | "monthly";

const timeFilterLabels: Record<TimeFilter, string> = {
  daily: "יומי",
  weekly: "שבועי",
  monthly: "חודשי",
};

type DeliveryWithPayment = Delivery & { payment: number };

export default function MyPaymentsScreen() {
  const { user, deliveries, allUsers, getAvailableDeliveries, takeDelivery, takeDeliveryMutationStatus, dismissedDeliveryIds, dismissDelivery, confirmDelivery } = useDelivery();
  const insets = useSafeAreaInsets();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const previousCountRef = useRef<number>(0);
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const notificationTranslateY = useRef(new Animated.Value(-100)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSoundLoaded, setIsSoundLoaded] = useState<boolean>(false);
  const [newDeliveryId, setNewDeliveryId] = useState<string | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [newlyTakenDelivery, setNewlyTakenDelivery] = useState<Delivery | null>(null);
  const [confirmedDeliveryIds, setConfirmedDeliveryIds] = useState<Set<string>>(new Set());
  const previousDeliveriesRef = useRef<Delivery[]>([]);

  const completedDeliveries = useMemo(() => {
    if (!user || user.role !== "courier") {
      return [];
    }
    return deliveries
      .filter(
        (delivery) => delivery.courierId === user.id && delivery.status === "completed"
      )
      .map((delivery) => ({
        ...delivery,
        payment: delivery.payment ?? 25,
      })) as DeliveryWithPayment[];
  }, [deliveries, user]);

  const filteredDeliveries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return completedDeliveries.filter((delivery) => {
      const deliveryDate = new Date(delivery.createdAt);
      switch (timeFilter) {
        case "daily":
          return deliveryDate >= todayStart;
        case "weekly":
          return deliveryDate >= weekStart;
        case "monthly":
          return deliveryDate >= monthStart;
        default:
          return true;
      }
    });
  }, [completedDeliveries, timeFilter]);

  const totalPayment = useMemo(() => {
    return filteredDeliveries.reduce((sum, delivery) => sum + delivery.payment, 0);
  }, [filteredDeliveries]);

  const getBusinessName = (businessId: string): string => {
    const business = allUsers.find((u: User) => u.id === businessId);
    return business?.name || "לא ידוע";
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    let isActive = true;

    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: "https://drive.google.com/uc?export=download&id=1snW_Csg-2uhsJe6yKPvVbNMD1bApolID" },
          { shouldPlay: false }
        );
        if (isActive) {
          soundRef.current = sound;
          setIsSoundLoaded(true);
          console.log("Notification sound preloaded successfully");
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.log("Sound preload failed", error);
      }
    };

    void loadSound();

    return () => {
      isActive = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => {
          console.log("Sound unload failed", error);
        });
      }
    };
  }, []);

  const playNotificationSound = useCallback(async () => {
    try {
      if (soundRef.current && isSoundLoaded) {
        await soundRef.current.replayAsync();
        console.log("Notification sound played");
      } else {
        console.log("Sound not loaded yet, skipping playback");
      }
    } catch (error) {
      console.log("Sound playback failed", error);
    }
  }, [isSoundLoaded]);

  const availableDeliveriesForNotification = useMemo(() => getAvailableDeliveries(), [getAvailableDeliveries]);

  useEffect(() => {
    if (!user || user.role !== "courier") {
      return;
    }

    const isAvailable = user.courierProfile?.isAvailable ?? false;
    if (!isAvailable) {
      previousCountRef.current = availableDeliveriesForNotification.length;
      return;
    }

    const currentCount = availableDeliveriesForNotification.length;
    const previousCount = previousCountRef.current;

    if (previousCount > 0 && currentCount > previousCount) {
      const newDeliveriesCount = currentCount - previousCount;
      console.log(`New delivery notification in my-payments: ${newDeliveriesCount} new deliveries detected`);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      void playNotificationSound();
      
      const latestDelivery = availableDeliveriesForNotification[0];
      if (latestDelivery && !dismissedDeliveryIds.has(latestDelivery.id)) {
        setNewDeliveryId(latestDelivery.id);
        setIsPopupVisible(true);
      }
      
      setShowNotification(true);

      Animated.parallel([
        Animated.timing(notificationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(notificationTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(notificationOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(notificationTranslateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowNotification(false);
        });
      }, 4000);
    }

    previousCountRef.current = currentCount;
  }, [availableDeliveriesForNotification, availableDeliveriesForNotification.length, user, notificationOpacity, notificationTranslateY, playNotificationSound, dismissedDeliveryIds]);

  const handlePopupAccept = useCallback(() => {
    if (!newDeliveryId) return;
    dismissDelivery(newDeliveryId);
    setIsPopupVisible(false);
    setSelectedDeliveryId(newDeliveryId);
    setNewDeliveryId(null);
    setIsTimeModalVisible(true);
  }, [newDeliveryId, dismissDelivery]);

  const handlePopupReject = useCallback(() => {
    if (newDeliveryId) {
      dismissDelivery(newDeliveryId);
    }
    setIsPopupVisible(false);
    setNewDeliveryId(null);
  }, [newDeliveryId, dismissDelivery]);

  useEffect(() => {
    if (newDeliveryId && dismissedDeliveryIds.has(newDeliveryId)) {
      console.log("Delivery was dismissed in another tab, closing popup", newDeliveryId);
      setIsPopupVisible(false);
      setNewDeliveryId(null);
    }
  }, [newDeliveryId, dismissedDeliveryIds]);

  useEffect(() => {
    if (!user || user.role !== "business") {
      return;
    }

    const businessDeliveries = deliveries.filter((d) => d.businessId === user.id);
    const previousDeliveries = previousDeliveriesRef.current;

    businessDeliveries.forEach((delivery) => {
      if (delivery.status === "taken" && !delivery.businessConfirmed && !confirmedDeliveryIds.has(delivery.id)) {
        const previous = previousDeliveries.find((d) => d.id === delivery.id);
        if (!previous || previous.status !== "taken") {
          console.log("New delivery taken by courier in my-payments", delivery.id);
          setNewlyTakenDelivery(delivery);
        }
      }
    });

    previousDeliveriesRef.current = businessDeliveries;
  }, [deliveries, user, confirmedDeliveryIds]);

  const handleConfirmDelivery = useCallback(async () => {
    if (!newlyTakenDelivery) {
      return;
    }
    console.log("Confirming delivery", newlyTakenDelivery.id);
    await confirmDelivery(newlyTakenDelivery.id);
    setConfirmedDeliveryIds((prev) => new Set([...prev, newlyTakenDelivery.id]));
    setNewlyTakenDelivery(null);
  }, [newlyTakenDelivery, confirmDelivery]);

  const courierName = useMemo(() => {
    if (!newlyTakenDelivery?.courierId) {
      return undefined;
    }
    const courier = allUsers.find((u) => u.id === newlyTakenDelivery.courierId);
    return courier?.name;
  }, [newlyTakenDelivery, allUsers]);

  const handleTimeSelect = useCallback(async (minutes: number) => {
    if (!selectedDeliveryId) return;
    setIsTimeModalVisible(false);
    try {
      await takeDelivery(selectedDeliveryId, minutes);
    } catch (error) {
      console.log("Take delivery error", error);
    } finally {
      setSelectedDeliveryId(null);
    }
  }, [selectedDeliveryId, takeDelivery]);

  const handleCloseModal = useCallback(() => {
    setIsTimeModalVisible(false);
    setSelectedDeliveryId(null);
  }, []);

  const newDelivery = newDeliveryId
    ? availableDeliveriesForNotification.find((d) => d.id === newDeliveryId) ?? null
    : null;
  const newDeliveryBusiness = newDelivery
    ? allUsers.find((u) => u.id === newDelivery.businessId)
    : null;
  const selectedDelivery = selectedDeliveryId
    ? availableDeliveriesForNotification.find((d) => d.id === selectedDeliveryId)
    : null;
  const selectedBusiness = selectedDelivery
    ? allUsers.find((u) => u.id === selectedDelivery.businessId)
    : null;
  const minPreparationTime = selectedDelivery?.preparationTimeMinutes ?? 0;

  const contentStyle = useMemo(
    () => [
      styles.container,
      { paddingTop: 28 + insets.top, paddingBottom: 120 + insets.bottom },
    ],
    [insets.bottom, insets.top]
  );

  return (
    <View style={styles.screenWrapper}>
      {showNotification && (
        <Animated.View
          style={[
            styles.notification,
            {
              opacity: notificationOpacity,
              transform: [{ translateY: notificationTranslateY }],
              top: insets.top + 16,
            },
          ]}
          testID="new-delivery-notification"
        >
          <Text style={styles.notificationIcon}>🔔</Text>
          <View style={styles.notificationTextContainer}>
            <Text style={styles.notificationTitle}>משלוח חדש במערכת!</Text>
            <Text style={styles.notificationSubtitle}>יש משלוח חדש זמין לתפיסה</Text>
          </View>
        </Animated.View>
      )}
      <ScrollView
        style={[styles.screen, { paddingTop: insets.top }]}
        contentContainerStyle={contentStyle}
        testID="my-payments-scroll"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>התשלומים שלי</Text>
          <Text style={styles.subheading}>עקוב אחרי הרווחים שלך ממשלוחים</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>סה״כ תשלומים</Text>
          <Text style={styles.summaryAmount}>₪{totalPayment}</Text>
          <Text style={styles.summarySubtitle}>{filteredDeliveries.length} משלוחים</Text>
        </View>

        <View style={styles.filterRow}>
          {(Object.keys(timeFilterLabels) as TimeFilter[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => setTimeFilter(key)}
              style={[
                styles.filterChip,
                timeFilter === key && styles.filterChipActive,
              ]}
              testID={`filter-${key}`}
            >
              <Text
                style={[
                  styles.filterChipText,
                  timeFilter === key && styles.filterChipTextActive,
                ]}
              >
                {timeFilterLabels[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.list}>
          {filteredDeliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>אין משלוחים בתקופה זו</Text>
              <Text style={styles.emptyStateSubtitle}>
                המשלוחים שתשלים יופיעו כאן
              </Text>
            </View>
          ) : (
            filteredDeliveries.map((delivery) => {
              const businessName = getBusinessName(delivery.businessId);
              const pickupTime = formatTime(delivery.confirmedAt || delivery.createdAt);
              const dropoffTime = delivery.pickedUpAt
                ? formatTime(delivery.pickedUpAt)
                : "-";

              return (
                <View
                  key={delivery.id}
                  style={styles.deliveryCard}
                  testID={`payment-delivery-${delivery.id}`}
                >
                  <View style={styles.deliveryHeader}>
                    <View style={styles.deliveryInfo}>
                      <Text style={styles.businessName}>{businessName}</Text>
                      <View style={styles.deliveryTimes}>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeLabel}>זמן איסוף:</Text>
                          <Text style={styles.timeValue}>{pickupTime}</Text>
                        </View>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeLabel}>שעת מסירה:</Text>
                          <Text style={styles.timeValue}>{dropoffTime}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.paymentBadge}>
                      <Text style={styles.paymentAmount}>₪{delivery.payment}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

      <TimeSelectionModal
        visible={isTimeModalVisible}
        onClose={handleCloseModal}
        onSelect={handleTimeSelect}
        businessName={selectedBusiness?.name}
        minTime={minPreparationTime}
      />

      <NewDeliveryFullScreenPopup
        visible={isPopupVisible}
        delivery={newDelivery}
        businessName={newDeliveryBusiness?.name}
        onAccept={handlePopupAccept}
        onReject={handlePopupReject}
        disabled={takeDeliveryMutationStatus === "pending"}
      />

      <CourierAssignedBottomSheet
        visible={!!newlyTakenDelivery && !newlyTakenDelivery.businessConfirmed}
        delivery={newlyTakenDelivery}
        courierName={courierName}
        onConfirm={handleConfirmDelivery}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
    gap: 24,
  },
  headerBlock: {
    alignItems: "flex-end" as const,
    gap: 8,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800" as const,
    color: Colors.light.text,
    writingDirection: "rtl" as const,
  },
  subheading: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: "right" as const,
    writingDirection: "rtl" as const,
  },
  summaryCard: {
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    padding: 24,
    alignItems: "center" as const,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "rgba(255, 255, 255, 0.9)",
    writingDirection: "rtl" as const,
  },
  summaryAmount: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: "#ffffff",
    writingDirection: "rtl" as const,
  },
  summarySubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    writingDirection: "rtl" as const,
  },
  filterRow: {
    flexDirection: "row-reverse" as const,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(148, 163, 209, 0.16)",
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.tint,
    writingDirection: "rtl" as const,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  list: {
    flexDirection: "column" as const,
    gap: 16,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center" as const,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    writingDirection: "rtl" as const,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: "center" as const,
    writingDirection: "rtl" as const,
  },
  deliveryCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  deliveryHeader: {
    flexDirection: "row-reverse" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    gap: 16,
  },
  deliveryInfo: {
    flex: 1,
    alignItems: "flex-end" as const,
    gap: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    writingDirection: "rtl" as const,
  },
  deliveryTimes: {
    gap: 6,
    alignItems: "flex-end" as const,
  },
  timeRow: {
    flexDirection: "row-reverse" as const,
    gap: 8,
    alignItems: "center" as const,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl" as const,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
    writingDirection: "rtl" as const,
  },
  paymentBadge: {
    backgroundColor: Colors.light.completed,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minWidth: 80,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#ffffff",
    writingDirection: "rtl" as const,
  },
  notification: {
    position: "absolute" as const,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  notificationIcon: {
    fontSize: 28,
  },
  notificationTextContainer: {
    flex: 1,
    alignItems: "flex-end" as const,
    gap: 2,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#ffffff",
    writingDirection: "rtl" as const,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    writingDirection: "rtl" as const,
  },
});
