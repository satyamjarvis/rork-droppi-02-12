import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NewDeliveryFullScreenPopup } from "./NewDeliveryFullScreenPopup";
import { TimeSelectionModal } from "./TimeSelectionModal";
import { useDelivery } from "../providers/DeliveryProvider";

export function GlobalDeliveryNotifications() {
  const router = useRouter();
  const { 
    user, 
    allUsers, 
    getAvailableDeliveries, 
    dismissedDeliveryIds, 
    dismissDelivery,
    takeDelivery,
    takeDeliveryMutationStatus
  } = useDelivery();
  const insets = useSafeAreaInsets();

  const [newDeliveryId, setNewDeliveryId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [takeoverNotice, setTakeoverNotice] = useState<string | null>(null);
  const previousCountRef = useRef<number>(0);
  const lastAvailabilityRef = useRef<boolean>(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSoundLoaded, setIsSoundLoaded] = useState<boolean>(false);

  const availableDeliveries = useMemo(() => getAvailableDeliveries(), [getAvailableDeliveries]);

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
          console.log("Global notification sound preloaded successfully");
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.log("Global sound preload failed", error);
      }
    };

    if (user?.role === "courier") {
      void loadSound();
    }

    return () => {
      isActive = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => {
          console.log("Global sound unload failed", error);
        });
      }
    };
  }, [user?.role]);

  const playNotificationSound = useCallback(async () => {
    try {
      if (soundRef.current && isSoundLoaded) {
        await soundRef.current.replayAsync();
        console.log("Global notification sound played");
      } else {
        console.log("Global sound not loaded yet, skipping playback");
      }
    } catch (error) {
      console.log("Global sound playback failed", error);
    }
  }, [isSoundLoaded]);

  useEffect(() => {
    if (!user || user.role !== "courier") {
      previousCountRef.current = 0;
      lastAvailabilityRef.current = false;
      setIsPopupVisible(false);
      setNewDeliveryId(null);
      setSelectedDeliveryId(null);
      setIsTimeModalVisible(false);
      return;
    }

    const isAvailable = user.courierProfile?.isAvailable ?? false;
    const currentCount = availableDeliveries.length;

    if (!isAvailable) {
      previousCountRef.current = currentCount;
      lastAvailabilityRef.current = false;
      setIsPopupVisible(false);
      setIsTimeModalVisible(false);
      return;
    }

    if (!lastAvailabilityRef.current) {
      previousCountRef.current = 0;
    }

    lastAvailabilityRef.current = true;

    if (currentCount > previousCountRef.current) {
      const newDeliveriesCount = currentCount - previousCountRef.current;
      console.log(`Global new delivery notification: ${newDeliveriesCount} new deliveries detected`);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      void playNotificationSound();
      
      const nextDelivery = availableDeliveries.find((delivery) => !dismissedDeliveryIds.has(delivery.id));
      if (nextDelivery) {
        setNewDeliveryId(nextDelivery.id);
        setIsPopupVisible(true);
      }
    }

    previousCountRef.current = currentCount;
  }, [availableDeliveries, dismissedDeliveryIds, playNotificationSound, user]);

  const handlePopupAccept = useCallback(() => {
    if (!newDeliveryId) {
      return;
    }
    setIsPopupVisible(false);
    setSelectedDeliveryId(newDeliveryId);
    setIsTimeModalVisible(true);
  }, [newDeliveryId]);

  const handlePopupReject = useCallback(() => {
    if (newDeliveryId) {
      dismissDelivery(newDeliveryId);
    }
    setIsPopupVisible(false);
    setNewDeliveryId(null);
    setSelectedDeliveryId(null);
    setIsTimeModalVisible(false);
  }, [newDeliveryId, dismissDelivery]);

  useEffect(() => {
    if (newDeliveryId && dismissedDeliveryIds.has(newDeliveryId)) {
      console.log("Global delivery was dismissed, closing popup", newDeliveryId);
      setIsPopupVisible(false);
      setNewDeliveryId(null);
    }
  }, [newDeliveryId, dismissedDeliveryIds]);

  useEffect(() => {
    if (selectedDeliveryId && dismissedDeliveryIds.has(selectedDeliveryId)) {
      console.log("Selected delivery was dismissed, closing time modal", selectedDeliveryId);
      setIsTimeModalVisible(false);
      setSelectedDeliveryId(null);
    }
  }, [dismissedDeliveryIds, selectedDeliveryId]);

  useEffect(() => {
    if (!newDeliveryId && !selectedDeliveryId) {
      return;
    }

    const unavailableId = [newDeliveryId, selectedDeliveryId]
      .filter((id): id is string => Boolean(id))
      .find((id) => !availableDeliveries.some((delivery) => delivery.id === id));

    if (!unavailableId) {
      return;
    }

    console.log("Delivery became unavailable, closing global prompts", unavailableId);

    if (unavailableId === newDeliveryId) {
      setIsPopupVisible(false);
      setNewDeliveryId(null);
    }

    if (unavailableId === selectedDeliveryId) {
      setIsTimeModalVisible(false);
      setSelectedDeliveryId(null);
    }

    setTakeoverNotice("המשלוח נלקח על ידי שליח אחר");
  }, [availableDeliveries, newDeliveryId, selectedDeliveryId]);

  useEffect(() => {
    if (!takeoverNotice) {
      return;
    }

    const timeout = setTimeout(() => {
      setTakeoverNotice(null);
    }, 3200);

    return () => {
      clearTimeout(timeout);
    };
  }, [takeoverNotice]);

  const handleTimeSelect = useCallback(async (minutes: number) => {
    if (!selectedDeliveryId) {
      return;
    }
    setIsTimeModalVisible(false);
    try {
      await takeDelivery(selectedDeliveryId, minutes);
      dismissDelivery(selectedDeliveryId);
      setNewDeliveryId(null);
      router.push("/my-deliveries");
    } catch (error) {
      console.log("Global take delivery error", error);
      setIsPopupVisible(true);
      setNewDeliveryId(selectedDeliveryId);
    } finally {
      setSelectedDeliveryId(null);
    }
  }, [dismissDelivery, router, selectedDeliveryId, takeDelivery]);

  const handleTimeModalClose = useCallback(() => {
    setIsTimeModalVisible(false);
    if (selectedDeliveryId) {
      setIsPopupVisible(true);
    }
  }, [selectedDeliveryId]);

  const isLoading = takeDeliveryMutationStatus === "pending";
  const newDelivery = useMemo(() => {
    if (!newDeliveryId) {
      return null;
    }
    return availableDeliveries.find((delivery) => delivery.id === newDeliveryId) ?? null;
  }, [availableDeliveries, newDeliveryId]);

  const selectedDelivery = useMemo(() => {
    if (!selectedDeliveryId) {
      return null;
    }
    return availableDeliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? null;
  }, [availableDeliveries, selectedDeliveryId]);

  const newDeliveryBusiness = newDelivery
    ? allUsers.find((u) => u.id === newDelivery.businessId)
    : null;

  const selectedBusiness = selectedDelivery
    ? allUsers.find((u) => u.id === selectedDelivery.businessId)
    : null;

  const minPreparationTime = selectedDelivery?.preparationTimeMinutes ?? 0;

  if (user?.role !== "courier") {
    return null;
  }

  return (
    <>
      <NewDeliveryFullScreenPopup
        visible={isPopupVisible}
        delivery={newDelivery}
        businessName={newDeliveryBusiness?.name}
        onAccept={handlePopupAccept}
        onReject={handlePopupReject}
        disabled={isLoading}
      />
      <TimeSelectionModal
        visible={isTimeModalVisible}
        onClose={handleTimeModalClose}
        onSelect={handleTimeSelect}
        businessName={selectedBusiness?.name}
        minTime={minPreparationTime}
      />
      {takeoverNotice ? (
        <View
          pointerEvents="none"
          style={[styles.noticeContainer, { top: insets.top + 20 }]}
          testID="global-delivery-taken-notice"
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
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 1300,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
  },
  noticeText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    writingDirection: "rtl" as const,
  },
});
