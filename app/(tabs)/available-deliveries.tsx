import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";

import Colors from "../../constants/colors";
import { DeliveryCard } from "../../components/DeliveryCard";
import { EmptyState } from "../../components/EmptyState";
import { TimeSelectionModal } from "../../components/TimeSelectionModal";
import { CourierAssignedBottomSheet } from "../../components/CourierAssignedBottomSheet";
import { useDelivery } from "../../providers/DeliveryProvider";
import { Delivery } from "../../types/models";


export default function AvailableDeliveriesScreen() {
  const router = useRouter();
  const { user, allUsers, getAvailableDeliveries, takeDelivery, takeDeliveryMutationStatus, deliveries, confirmDelivery, confirmedBusinessDeliveryIds, confirmBusinessNotification } = useDelivery();
  const insets = useSafeAreaInsets();
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [newlyTakenDelivery, setNewlyTakenDelivery] = useState<Delivery | null>(null);
  const previousDeliveriesRef = useRef<Delivery[]>([]);
  const businessSoundRef = useRef<Audio.Sound | null>(null);
  const [isBusinessSoundLoaded, setIsBusinessSoundLoaded] = useState<boolean>(false);
  
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        router.replace("/");
        return;
      }
    }, [router, user]),
  );

  const availableDeliveries = useMemo(() => getAvailableDeliveries(), [getAvailableDeliveries]);

  useEffect(() => {
    let isActive = true;

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

    if (user?.role === "business") {
      void loadBusinessSound();
    }

    return () => {
      isActive = false;
      if (businessSoundRef.current) {
        businessSoundRef.current.unloadAsync().catch((error) => {
          console.log("Business sound unload failed", error);
        });
      }
    };
  }, [user?.role]);

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



  const handleTakeDelivery = useCallback((deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);
    setIsTimeModalVisible(true);
  }, []);

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



  useEffect(() => {
    if (!user || user.role !== "business") {
      return;
    }

    const businessDeliveries = deliveries.filter((d) => d.businessId === user.id);
    const previousDeliveries = previousDeliveriesRef.current;

    businessDeliveries.forEach((delivery) => {
      if (delivery.status === "taken" && !delivery.businessConfirmed && !confirmedBusinessDeliveryIds.has(delivery.id)) {
        const previous = previousDeliveries.find((d) => d.id === delivery.id);
        if (!previous || previous.status !== "taken") {
          console.log("New delivery taken by courier", delivery.id);
          void playBusinessNotificationSound();
          setNewlyTakenDelivery(delivery);
        }
      }
    });

    previousDeliveriesRef.current = businessDeliveries;
  }, [deliveries, user, confirmedBusinessDeliveryIds, playBusinessNotificationSound]);

  useEffect(() => {
    if (newlyTakenDelivery && confirmedBusinessDeliveryIds.has(newlyTakenDelivery.id)) {
      console.log("Delivery was confirmed in another tab, closing bottom sheet", newlyTakenDelivery.id);
      setNewlyTakenDelivery(null);
    }
  }, [newlyTakenDelivery, confirmedBusinessDeliveryIds]);

  const handleConfirmDelivery = useCallback(async () => {
    if (!newlyTakenDelivery) {
      return;
    }
    console.log("Confirming delivery", newlyTakenDelivery.id);
    await confirmDelivery(newlyTakenDelivery.id);
    confirmBusinessNotification(newlyTakenDelivery.id);
    setNewlyTakenDelivery(null);
  }, [newlyTakenDelivery, confirmDelivery, confirmBusinessNotification]);

  const courierName = useMemo(() => {
    if (!newlyTakenDelivery?.courierId) {
      return undefined;
    }
    const courier = allUsers.find((u) => u.id === newlyTakenDelivery.courierId);
    return courier?.name;
  }, [newlyTakenDelivery, allUsers]);

  const isCourier = user?.role === "courier";


  const isLoading = takeDeliveryMutationStatus === "pending";
  const totalAvailable = availableDeliveries.length;
  const isAvailable = user?.role === "courier" ? (user.courierProfile?.isAvailable ?? false) : true;
  const selectedDelivery = selectedDeliveryId
    ? availableDeliveries.find((d) => d.id === selectedDeliveryId)
    : null;
  const selectedBusiness = selectedDelivery
    ? allUsers.find((u) => u.id === selectedDelivery.businessId)
    : null;
  const minPreparationTime = selectedDelivery?.preparationTimeMinutes ?? 0;

  const contentStyle = useMemo(
    () => [styles.container, { paddingTop: 32 + insets.top, paddingBottom: 120 + insets.bottom }],
    [insets.bottom, insets.top],
  );

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={[styles.screen, { paddingTop: insets.top }]}
        contentContainerStyle={contentStyle}
        testID="available-deliveries-scroll"
      >
      <View style={styles.headerBlock}>
        <Text style={styles.heading}>משלוחים זמינים</Text>
        <Text style={styles.subheading}>
          {isCourier
            ? "בחרו משלוח ולחצו על אני לוקח. הראשון שקולט את המשלוח זוכה."
            : "שליחים רואים כאן משלוחים זמינים בזמן אמת."}
        </Text>

        <View style={styles.counterCard} testID="available-counter">
          <Text style={styles.counterLabel}>משלוחים שממתינים כעת</Text>
          <Text style={styles.counterValue}>{totalAvailable}</Text>
        </View>


      </View>

      <View style={styles.list}>
        {availableDeliveries.length === 0 ? (
          <EmptyState
            title={isCourier && !isAvailable ? "הפעל מצב 'זמין למשלוחים'" : "כרגע אין משלוחים ממתינים"}
            subtitle={isCourier && !isAvailable ? "כדי לראות ולתפוס משלוחים בזמן אמת" : "חזרו לכאן בעוד מספר דקות כדי לראות אם נוסף משלוח חדש"}
            testID="empty-available-deliveries"
          />
        ) : (
          availableDeliveries.map((delivery) => {
            const business = allUsers.find((u) => u.id === delivery.businessId);
            return (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                headline="משלוח ממתין לשיוך"
                businessName={business?.name}
                primaryActionLabel={isCourier ? "אני לוקח" : undefined}
                onPrimaryAction={isCourier ? () => handleTakeDelivery(delivery.id) : undefined}
                disabled={isLoading}
                showCustomerInfo={false}
                showNotes={false}
                testID={`available-${delivery.id}`}
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
    paddingBottom: 120,
    gap: 24,
  },
  headerBlock: {
    alignItems: "flex-end",
    gap: 16,
  },
  counterCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "flex-end",
    gap: 4,
  },
  counterLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  counterValue: {
    fontSize: 22,
    fontWeight: "800",
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
    lineHeight: 22,
    flexWrap: "wrap",
  },
  list: {
    flexDirection: "column",
    gap: 18,
  },

});
