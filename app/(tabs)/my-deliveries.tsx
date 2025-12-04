import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

import Colors from "../../constants/colors";
import { Delivery, DeliveryStatus } from "../../types/models";
import { useDelivery } from "../../providers/DeliveryProvider";
import { DeliveryCard } from "../../components/DeliveryCard";
import { EmptyState } from "../../components/EmptyState";
import { TimeSelectionModal } from "../../components/TimeSelectionModal";
import { NewDeliveryFullScreenPopup } from "../../components/NewDeliveryFullScreenPopup";
import { CourierAssignedBottomSheet } from "../../components/CourierAssignedBottomSheet";

const statusFilterLabelsForBusiness: Record<DeliveryStatus | "all", string> = {
  all: "הכל",
  waiting: "ממתין",
  taken: "נלקח",
  completed: "הושלם",
};

const statusFilterLabelsForCourier: Record<Exclude<DeliveryStatus, "waiting"> | "all", string> = {
  all: "הכל",
  taken: "נלקח",
  completed: "הושלם",
};

export default function MyDeliveriesScreen() {
  const router = useRouter();
  const {
    user,
    allUsers,
    getDeliveriesForUser,
    getAvailableDeliveries,
    pickupDelivery,
    pickupDeliveryMutationStatus,
    completeDelivery,
    completeDeliveryMutationStatus,
    confirmDelivery,
    confirmDeliveryMutationStatus,
    markReady,
    markReadyMutationStatus,
    takeDelivery,
    takeDeliveryMutationStatus,
    updateAvailability,
    updateAvailabilityMutationStatus,
    logout,
    dismissedDeliveryIds,
    dismissDelivery,
    confirmedBusinessDeliveryIds,
    confirmBusinessNotification,
  } = useDelivery();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const insets = useSafeAreaInsets();
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const previousCountRef = useRef<number>(0);
  const lastAvailabilityRef = useRef<boolean>(false);
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const notificationTranslateY = useRef(new Animated.Value(-100)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSoundLoaded, setIsSoundLoaded] = useState<boolean>(false);
  const [newDeliveryId, setNewDeliveryId] = useState<string | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [newlyTakenDelivery, setNewlyTakenDelivery] = useState<Delivery | null>(null);
  const previousDeliveriesRefForBusiness = useRef<Delivery[]>([]);
  const businessSoundRef = useRef<Audio.Sound | null>(null);
  const [isBusinessSoundLoaded, setIsBusinessSoundLoaded] = useState<boolean>(false);

  const currentUser = useMemo(() => {
    if (!user) return null;
    return allUsers.find((u) => u.id === user.id) || user;
  }, [user, allUsers]);
  
  const statusFilterLabels = useMemo(() => {
    return currentUser?.role === "courier" ? statusFilterLabelsForCourier : statusFilterLabelsForBusiness;
  }, [currentUser?.role]);
  
  const availableFilters = useMemo(() => {
    if (currentUser?.role === "courier") {
      return ["all", "taken", "completed"] as const;
    }
    return ["all", "waiting", "taken", "completed"] as const;
  }, [currentUser?.role]);

  const isAvailable = currentUser?.role === "courier" ? currentUser.courierProfile?.isAvailable === true : false;

  useEffect(() => {
    console.log("Availability state:", {
      isAvailable,
      mutationStatus: updateAvailabilityMutationStatus,
      userId: currentUser?.id,
      role: currentUser?.role,
      courierProfile: currentUser?.role === "courier" ? currentUser.courierProfile : null
    });
  }, [isAvailable, updateAvailabilityMutationStatus, currentUser]);

  const handleToggleAvailability = useCallback(async () => {
    console.log("Toggle availability clicked", { 
      role: currentUser?.role, 
      isAvailable, 
      newValue: !isAvailable,
      userId: currentUser?.id 
    });
    if (currentUser?.role === "courier") {
      try {
        console.log("Calling updateAvailability mutation", !isAvailable);
        await updateAvailability(!isAvailable);
        console.log("updateAvailability succeeded");
      } catch (error) {
        console.log("Toggle availability failed", error);
      }
    } else {
      console.log("User is not a courier, cannot toggle availability");
    }
  }, [isAvailable, updateAvailability, currentUser?.role, currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        router.replace("/");
      }
    }, [router, user]),
  );

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [router, user]);

  const deliveries = useMemo(() => {
    if (!user) {
      return [];
    }
    const items = getDeliveriesForUser(user.role, user.id);
    if (statusFilter === "all") {
      return items;
    }
    return items.filter((delivery) => delivery.status === statusFilter);
  }, [getDeliveriesForUser, statusFilter, user]);

  const counts = useMemo(() => {
    if (!user) {
      return { total: 0, waiting: 0, taken: 0, completed: 0 };
    }
    const items = getDeliveriesForUser(user.role, user.id);
    return {
      total: items.length,
      waiting: items.filter((delivery) => delivery.status === "waiting").length,
      taken: items.filter((delivery) => delivery.status === "taken").length,
      completed: items.filter((delivery) => delivery.status === "completed").length,
    };
  }, [getDeliveriesForUser, user]);

  const handleSetFilter = (nextFilter: DeliveryStatus | "all") => {
    setStatusFilter(nextFilter);
  };

  const loadingAction = completeDeliveryMutationStatus === "pending" || takeDeliveryMutationStatus === "pending" || pickupDeliveryMutationStatus === "pending" || confirmDeliveryMutationStatus === "pending" || markReadyMutationStatus === "pending";

  const availableDeliveriesForNotification = useMemo(() => getAvailableDeliveries(), [getAvailableDeliveries]);

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

    const loadBusinessSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: "https://docs.google.com/uc?export=download&id=18wyLCPRpigCQJowNq9ef4k7uCqpctDP4" },
          { shouldPlay: false }
        );
        if (isActive) {
          businessSoundRef.current = sound;
          setIsBusinessSoundLoaded(true);
          console.log("Business notification sound preloaded successfully");
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.log("Business sound preload failed", error);
      }
    };

    void loadSound();
    if (currentUser?.role === "business") {
      void loadBusinessSound();
    }

    return () => {
      isActive = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => {
          console.log("Sound unload failed", error);
        });
      }
      if (businessSoundRef.current) {
        businessSoundRef.current.unloadAsync().catch((error) => {
          console.log("Business sound unload failed", error);
        });
      }
    };
  }, [currentUser?.role]);

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

  const playBusinessNotificationSound = useCallback(async () => {
    try {
      if (businessSoundRef.current && isBusinessSoundLoaded) {
        await businessSoundRef.current.replayAsync();
        console.log("Business notification sound played");
      } else {
        console.log("Business sound not loaded yet, skipping playback");
      }
    } catch (error) {
      console.log("Business sound playback failed", error);
    }
  }, [isBusinessSoundLoaded]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "courier") {
      lastAvailabilityRef.current = false;
      return;
    }

    const isAvailableNow = currentUser.courierProfile?.isAvailable ?? false;
    const currentCount = availableDeliveriesForNotification.length;

    if (!isAvailableNow) {
      previousCountRef.current = currentCount;
      lastAvailabilityRef.current = false;
      return;
    }

    if (!lastAvailabilityRef.current) {
      previousCountRef.current = 0;
    }
    lastAvailabilityRef.current = true;

    const previousCount = previousCountRef.current;

    if (currentCount > previousCount) {
      const newDeliveriesCount = currentCount - previousCount;
      console.log(`New delivery notification in my-deliveries: ${newDeliveriesCount} new deliveries detected`);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      void playNotificationSound();
      
      const nextUndismissedDelivery = availableDeliveriesForNotification.find((delivery) => !dismissedDeliveryIds.has(delivery.id));
      if (nextUndismissedDelivery) {
        setNewDeliveryId(nextUndismissedDelivery.id);
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
  }, [availableDeliveriesForNotification, currentUser, notificationOpacity, notificationTranslateY, playNotificationSound, dismissedDeliveryIds]);

  const handlePopupAccept = useCallback(() => {
    if (!newDeliveryId) return;
    setIsPopupVisible(false);
    setSelectedDeliveryId(newDeliveryId);
    setNewDeliveryId(null);
    setIsTimeModalVisible(true);
  }, [newDeliveryId]);

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
    if (!currentUser || currentUser.role !== "business") {
      return;
    }

    const businessDeliveries = allUsers.flatMap((u) => 
      u.id === currentUser.id ? getDeliveriesForUser("business", u.id) : []
    );
    const previousDeliveriesForBusiness = previousDeliveriesRefForBusiness.current;

    businessDeliveries.forEach((delivery) => {
      if (delivery.status === "taken" && !delivery.businessConfirmed && !confirmedBusinessDeliveryIds.has(delivery.id)) {
        const previous = previousDeliveriesForBusiness.find((d) => d.id === delivery.id);
        if (!previous || previous.status !== "taken") {
          console.log("New delivery taken by courier in my-deliveries", delivery.id);
          void playBusinessNotificationSound();
          setNewlyTakenDelivery(delivery);
        }
      }
    });

    previousDeliveriesRefForBusiness.current = businessDeliveries;
  }, [currentUser, allUsers, getDeliveriesForUser, confirmedBusinessDeliveryIds, playBusinessNotificationSound]);

  useEffect(() => {
    if (newlyTakenDelivery && confirmedBusinessDeliveryIds.has(newlyTakenDelivery.id)) {
      console.log("Delivery was confirmed in another tab, closing bottom sheet", newlyTakenDelivery.id);
      setNewlyTakenDelivery(null);
    }
  }, [newlyTakenDelivery, confirmedBusinessDeliveryIds]);

  const handleConfirmDeliveryBusiness = useCallback(async () => {
    if (!newlyTakenDelivery) {
      return;
    }
    console.log("Confirming delivery", newlyTakenDelivery.id);
    await confirmDelivery(newlyTakenDelivery.id);
    confirmBusinessNotification(newlyTakenDelivery.id);
    setNewlyTakenDelivery(null);
  }, [newlyTakenDelivery, confirmDelivery, confirmBusinessNotification]);

  const courierNameForBusiness = useMemo(() => {
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
      dismissDelivery(selectedDeliveryId);
    } catch (error) {
      console.log("Take delivery error", error);
      setIsPopupVisible(true);
      setNewDeliveryId(selectedDeliveryId);
    } finally {
      setSelectedDeliveryId(null);
    }
  }, [dismissDelivery, selectedDeliveryId, takeDelivery]);

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
    () => [styles.container, { paddingTop: 28 + insets.top, paddingBottom: 120 + insets.bottom }],
    [insets.bottom, insets.top],
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
        testID="my-deliveries-scroll"
      >
      <View style={styles.headerBlock}>
        <Pressable onPress={logout} style={styles.logoutButton} testID="logout-button">
          <Text style={styles.logoutText}>התנתק</Text>
        </Pressable>
        <View style={styles.userRow}>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userRole}>{user?.role === "business" ? "עסק" : "שליח"}</Text>
          </View>
        </View>
        {user?.role === "courier" && (
          <View style={styles.availabilityCard}>
            <View style={styles.availabilityContent}>
              <View style={styles.availabilityText}>
                <Text style={styles.availabilityTitle}>
                  {isAvailable ? "זמין למשלוחים" : "לא זמין למשלוחים"}
                </Text>
                <Text style={styles.availabilitySubtitle}>
                  {isAvailable ? "תוכל לקבל הצעות משלוח חדשות" : "לא תקבל הצעות משלוח חדשות"}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                disabled={updateAvailabilityMutationStatus === "pending"}
                trackColor={{ false: Colors.light.border, true: Colors.light.tint }}
                thumbColor="#ffffff"
                testID="availability-toggle"
              />
            </View>
          </View>
        )}
        <Text style={styles.heading}>המשלוחים שלי</Text>
        <Text style={styles.subheading}>
          {user?.role === "business"
            ? "עקבו אחרי ההזמנות שלכם בזמן אמת"
            : "סמנו משלוחים שהושלמו וראו את ההיסטוריה"}
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard} testID="summary-total">
            <Text style={styles.summaryTitle}>סה״כ</Text>
            <Text style={styles.summaryValue}>{counts.total}</Text>
          </View>
          {user?.role === "business" && (
            <View style={styles.summaryCard} testID="summary-waiting">
              <Text style={styles.summaryTitle}>ממתין</Text>
              <Text style={[styles.summaryValue, styles.waitingColor]}>{counts.waiting}</Text>
            </View>
          )}
          <View style={styles.summaryCard} testID="summary-taken">
            <Text style={styles.summaryTitle}>נלקח</Text>
            <Text style={[styles.summaryValue, styles.takenColor]}>{counts.taken}</Text>
          </View>
          <View style={styles.summaryCard} testID="summary-completed">
            <Text style={styles.summaryTitle}>הושלם</Text>
            <Text style={[styles.summaryValue, styles.completedColor]}>{counts.completed}</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {availableFilters.map((key) => (
          <Pressable
            key={key}
            onPress={() => handleSetFilter(key)}
            style={[styles.filterChip, statusFilter === key && styles.filterChipActive]}
            testID={`filter-${key}`}
          >
            <Text
              style={[styles.filterChipText, statusFilter === key && styles.filterChipTextActive]}
            >
              {statusFilterLabels[key as keyof typeof statusFilterLabels]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.list}>
        {deliveries.length === 0 ? (
          <EmptyState
            title="אין משלוחים ברשימה"
            subtitle="כשתהיו פעילים כאן – תראו את כל המשלוחים שלכם"
            testID="empty-my-deliveries"
          />
        ) : (
          deliveries.map((delivery) => {
            const business = allUsers.find((u) => u.id === delivery.businessId);
            const courier = delivery.courierId ? allUsers.find((u) => u.id === delivery.courierId) : null;
            const canConfirm = user?.role === "business" && delivery.status === "taken" && delivery.courierId && !delivery.businessConfirmed;
            const canMarkReady = user?.role === "business" && delivery.status === "taken" && delivery.businessConfirmed && !delivery.businessReady;
            const canPickup = user?.role === "courier" && delivery.status === "taken" && delivery.businessReady && !delivery.pickedUpAt;
            const canComplete = user?.role === "courier" && delivery.status === "taken" && delivery.pickedUpAt;
            
            const isCourierInfoAvailable = (() => {
              if (!delivery.courierId || !courier) return false;
              if (delivery.status === "taken") return true;
              if (delivery.status === "completed" && delivery.completedAt) {
                const completedTime = new Date(delivery.completedAt).getTime();
                const currentTime = Date.now();
                const twentyMinutesInMs = 20 * 60 * 1000;
                return (currentTime - completedTime) < twentyMinutesInMs;
              }
              return false;
            })();
            
            const showCourierPhone = user?.role === "business" && isCourierInfoAvailable && courier?.phone;
            const showCourierName = user?.role === "business" && isCourierInfoAvailable && courier?.name;
            const showCustomerInfoForBusiness = user?.role === "business" && (delivery.status === "taken" || delivery.status === "completed");
            return (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                headline={user?.role === "business" ? "משלוח מהעסק" : "משלוח מהעסק"}
                businessName={business?.name}
                courierName={showCourierName ? courier?.name : undefined}
                courierPhone={showCourierPhone ? courier?.phone : undefined}
                customerName={showCustomerInfoForBusiness ? delivery.customerName : delivery.customerName}
                customerPhone={showCustomerInfoForBusiness ? delivery.customerPhone : delivery.customerPhone}
                showCustomerInfoForBusiness={showCustomerInfoForBusiness}
                primaryActionLabel={
                  canComplete
                    ? "סמן כהושלם"
                    : canPickup
                    ? "נאסף מהעסק"
                    : canMarkReady
                    ? "סמן כמוכן"
                    : canConfirm
                    ? "אשר והתחל בהכנה"
                    : undefined
                }
                onPrimaryAction={
                  canComplete
                    ? async () => { await completeDelivery(delivery.id); }
                    : canPickup
                    ? async () => { await pickupDelivery(delivery.id); }
                    : canMarkReady
                    ? async () => { await markReady(delivery.id); }
                    : canConfirm
                    ? async () => { await confirmDelivery(delivery.id); }
                    : undefined
                }
                disabled={loadingAction}
                showNavigationButtons={user?.role === "courier"}
                showCustomerInfo={user?.role === "courier"}
                showNotes={true}
                testID={`delivery-${delivery.id}`}
              />
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
        courierName={courierNameForBusiness}
        onConfirm={handleConfirmDeliveryBusiness}
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
    alignItems: "flex-end",
    gap: 12,
  },
  userRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  userRole: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  logoutButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    marginBottom: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  subheading: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  summaryRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  summaryTitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  waitingColor: {
    color: Colors.light.waiting,
  },
  takenColor: {
    color: Colors.light.taken,
  },
  completedColor: {
    color: Colors.light.completed,
  },
  filterRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
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
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  list: {
    flexDirection: "column",
    gap: 16,
  },
  availabilityCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: "100%",
  },
  availabilityContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  availabilityText: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  availabilityTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
  },
  availabilitySubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
    textAlign: "right",
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
