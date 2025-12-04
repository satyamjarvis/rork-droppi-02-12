import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";


import { NewDeliveryFullScreenPopup } from "./NewDeliveryFullScreenPopup";
import { CourierAssignedBottomSheet } from "./CourierAssignedBottomSheet";
import { TimeSelectionModal } from "./TimeSelectionModal";
import { useDelivery } from "../providers/DeliveryProvider";
import { Delivery } from "../types/models";

export function RealtimeDeliveryNotifications() {
  const router = useRouter();
  const { 
    user, 
    allUsers, 
    dismissedDeliveryIds, 
    dismissDelivery,
    confirmedBusinessDeliveryIds,
    confirmBusinessNotification,
    takeDelivery,
    takeDeliveryMutationStatus
  } = useDelivery();
  const insets = useSafeAreaInsets();

  const [newDeliveryForCourier, setNewDeliveryForCourier] = useState<Delivery | null>(null);
  const [assignedDeliveryForBusiness, setAssignedDeliveryForBusiness] = useState<Delivery | null>(null);
  const [isNewDeliveryVisible, setIsNewDeliveryVisible] = useState<boolean>(false);
  const [isAssignedDeliveryVisible, setIsAssignedDeliveryVisible] = useState<boolean>(false);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [soundRef] = useState<{ current: Audio.Sound | null }>({ current: null });
  const [takeoverNotice, setTakeoverNotice] = useState<string | null>(null);

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
          console.log("[REALTIME] Notification sound preloaded successfully");
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.log("[REALTIME] Sound preload failed", error);
      }
    };

    if (user) {
      void loadSound();
    }

    return () => {
      isActive = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => {
          console.log("[REALTIME] Sound unload failed", error);
        });
      }
    };
  }, [user, soundRef]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playNotificationSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
        console.log("[REALTIME] Notification sound played");
      }
    } catch (error) {
      console.log("[REALTIME] Sound playback failed", error);
    }
  }, [soundRef]);

  useEffect(() => {
    if (!user) return;
    
    console.log("[REALTIME] Realtime subscriptions would be set up here");
    console.log("[REALTIME] Using Supabase realtime instead of tRPC subscriptions");
    
    return () => {
      console.log("[REALTIME] Cleanup realtime subscriptions");
    };
  }, [user]);

  const handleCourierAccept = useCallback(() => {
    if (!newDeliveryForCourier || !user || user.role !== "courier") {
      return;
    }

    console.log("[REALTIME] Courier accepted delivery, opening time picker");
    setIsNewDeliveryVisible(false);
    setIsTimeModalVisible(true);
  }, [newDeliveryForCourier, user]);

  const handleCourierReject = useCallback(() => {
    if (newDeliveryForCourier) {
      dismissDelivery(newDeliveryForCourier.id);
    }
    setIsNewDeliveryVisible(false);
    setNewDeliveryForCourier(null);
  }, [newDeliveryForCourier, dismissDelivery]);

  const handleBusinessAccept = useCallback(async () => {
    if (!assignedDeliveryForBusiness) return;
    confirmBusinessNotification(assignedDeliveryForBusiness.id);
    setIsAssignedDeliveryVisible(false);
    setAssignedDeliveryForBusiness(null);
    router.push("/my-deliveries");
  }, [assignedDeliveryForBusiness, confirmBusinessNotification, router]);

  useEffect(() => {
    if (newDeliveryForCourier && dismissedDeliveryIds.has(newDeliveryForCourier.id)) {
      console.log("[REALTIME] Delivery was dismissed externally, closing bottom sheet");
      setIsNewDeliveryVisible(false);
      setNewDeliveryForCourier(null);
    }
  }, [newDeliveryForCourier, dismissedDeliveryIds]);

  useEffect(() => {
    if (assignedDeliveryForBusiness && confirmedBusinessDeliveryIds.has(assignedDeliveryForBusiness.id)) {
      console.log("[REALTIME] Business delivery was confirmed externally, closing bottom sheet");
      setIsAssignedDeliveryVisible(false);
      setAssignedDeliveryForBusiness(null);
    }
  }, [assignedDeliveryForBusiness, confirmedBusinessDeliveryIds]);

  const handleTimeSelect = useCallback(async (minutes: number) => {
    if (!newDeliveryForCourier || !user || user.role !== "courier") {
      return;
    }
    
    console.log("[REALTIME] Taking delivery with estimated arrival:", minutes);
    setIsTimeModalVisible(false);
    setIsNewDeliveryVisible(false);
    
    try {
      await takeDelivery(newDeliveryForCourier.id, minutes);
      dismissDelivery(newDeliveryForCourier.id);
      setNewDeliveryForCourier(null);
      console.log("[REALTIME] Delivery taken successfully, navigating to my-deliveries");
      router.push("/my-deliveries");
    } catch (error) {
      console.log("[REALTIME] Take delivery error", error);
      setIsNewDeliveryVisible(true);
    }
  }, [newDeliveryForCourier, user, dismissDelivery, router, takeDelivery]);

  const handleTimeModalClose = useCallback(() => {
    console.log("[REALTIME] Time modal closed, reopening delivery modal");
    setIsTimeModalVisible(false);
    setIsNewDeliveryVisible(true);
  }, []);

  const isLoading = takeDeliveryMutationStatus === "pending";
  const businessName = newDeliveryForCourier
    ? allUsers.find((u) => u.id === newDeliveryForCourier.businessId)?.name
    : undefined;

  const courierForBusiness = assignedDeliveryForBusiness
    ? allUsers.find((u) => u.id === assignedDeliveryForBusiness.courierId)
    : undefined;
    
  const minPreparationTime = newDeliveryForCourier?.preparationTimeMinutes ?? 0;

  useEffect(() => {
    if (!takeoverNotice) {
      return;
    }
    const timer = setTimeout(() => {
      setTakeoverNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [takeoverNotice]);

  if (!user) {
    return null;
  }

  return (
    <>
      {user.role === "courier" && (
        <>
          <NewDeliveryFullScreenPopup
            visible={isNewDeliveryVisible}
            delivery={newDeliveryForCourier}
            businessName={businessName}
            onAccept={handleCourierAccept}
            onReject={handleCourierReject}
            disabled={isLoading}
          />
          <TimeSelectionModal
            visible={isTimeModalVisible}
            onClose={handleTimeModalClose}
            onSelect={handleTimeSelect}
            businessName={businessName}
            minTime={minPreparationTime}
          />
        </>
      )}

      {user.role === "business" && (
        <CourierAssignedBottomSheet
          visible={isAssignedDeliveryVisible}
          delivery={assignedDeliveryForBusiness}
          courierName={courierForBusiness?.name}
          onConfirm={handleBusinessAccept}
        />
      )}

      {takeoverNotice ? (
        <View
          pointerEvents="none"
          style={[styles.noticeContainer, { top: insets.top + 20 }]}
          testID="delivery-taken-notice"
        >
          <Text style={styles.noticeText}>{takeoverNotice}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  noticeContainer: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17, 17, 17, 0.92)",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    alignSelf: "center" as const,
    zIndex: 1200,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 12,
  },
  noticeText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800" as const,
    writingDirection: "rtl" as const,
    textAlign: "center" as const,
  },
});
