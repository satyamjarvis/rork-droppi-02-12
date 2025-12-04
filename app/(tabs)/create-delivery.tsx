import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { MapPin, ChevronDown, UserCheck, CreditCard, Banknote } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useQuery, useMutation } from "@tanstack/react-query";

import Colors from "../../constants/colors";
import { useDelivery } from "../../providers/DeliveryProvider";
import { TimeSelectionModal } from "../../components/TimeSelectionModal";
import { CourierAssignedBottomSheet } from "../../components/CourierAssignedBottomSheet";
import { Customer, Delivery } from "../../types/models";
import { streetsStore, streetCityLabels, StreetCityKey } from "../stores/streetsStore";

const fieldPlaceholders = {
  customerName: "למשל: יוסי כהן",
  customerPhone: "למשל: 050-1234567",
  dropoffAddress: "בחרו עיר ואז הקלידו רחוב ומספר בית",
  notes: "קוד כניסה, הוראות מסירה וכדומה",
};

type CityOption = {
  key: StreetCityKey;
  label: string;
  streets: string[];
};

const MIN_STREET_QUERY_LENGTH = 2;
const MAX_STREET_SUGGESTIONS = 10;
const EMPTY_STREET_LIST: string[] = [];
const STREET_PREFIXES = ["רחוב", "רח", "שדרות", "שד", "דרך", "כביש"] as const;
const CITY_KEYS: StreetCityKey[] = ["ramatHasharon", "herzliya"];

const CITY_OPTIONS: CityOption[] = CITY_KEYS.map((key) => ({
  key,
  label: streetCityLabels[key],
  streets: streetsStore[key],
}));

const MIN_PHONE_DIGITS_FOR_LOOKUP = 9;

const normalizeStreetQuery = (value: string) =>
  value.replace(/[0-9]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const stripStreetPrefixes = (value: string) => {
  let result = value.trim();
  let hasPrefix = true;

  while (hasPrefix) {
    hasPrefix = false;

    for (const prefix of STREET_PREFIXES) {
      if (result.startsWith(prefix)) {
        result = result.slice(prefix.length).trimStart();
        result = result.replace(/^['"״׳]+/, "").trimStart();
        hasPrefix = true;
        break;
      }
    }
  }

  return result;
};

const streetMatchesQuery = (streetLower: string, normalizedQuery: string) => {
  if (streetLower.includes(normalizedQuery)) {
    return true;
  }
  const stripped = stripStreetPrefixes(streetLower);
  return stripped.includes(normalizedQuery);
};

const searchStreets = (streets: string[], query: string, isNormalized = false) => {
  const normalizedQuery = isNormalized ? query : normalizeStreetQuery(query);
  if (normalizedQuery.length < MIN_STREET_QUERY_LENGTH) {
    return EMPTY_STREET_LIST;
  }
  const results: string[] = [];
  for (const street of streets) {
    const streetLower = street.toLowerCase();
    if (streetMatchesQuery(streetLower, normalizedQuery)) {
      results.push(street);
    }
    if (results.length === MAX_STREET_SUGGESTIONS) {
      break;
    }
  }
  return results;
};

export default function CreateDeliveryScreen() {
  const router = useRouter();
  const { user, createDelivery, createDeliveryMutationStatus, deliveries, allUsers, confirmDelivery, confirmedBusinessDeliveryIds, confirmBusinessNotification } = useDelivery();
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [dropoffStreet, setDropoffStreet] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [preparationTime, setPreparationTime] = useState<number | null>(null);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState<boolean>(false);
  const [newlyTakenDelivery, setNewlyTakenDelivery] = useState<Delivery | null>(null);
  const [selectedCityKey, setSelectedCityKey] = useState<StreetCityKey | null>(null);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState<boolean>(false);
  const [streetSelectionLocked, setStreetSelectionLocked] = useState<boolean>(false);
  const [floor, setFloor] = useState<string>("");
  const [customerAutoFilled, setCustomerAutoFilled] = useState<boolean>(false);
  const [lookupPhone, setLookupPhone] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "cash">("credit");
  const [cashAmount, setCashAmount] = useState<string>("");
  const phoneLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCityLabel = useMemo(() => (selectedCityKey ? streetCityLabels[selectedCityKey] : null), [selectedCityKey]);
  const previousDeliveriesRef = useRef<Delivery[]>([]);
  const insets = useSafeAreaInsets();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isSoundLoaded, setIsSoundLoaded] = useState<boolean>(false);

  const isBusiness = user?.role === "business";
  const isLoading = createDeliveryMutationStatus === "pending";

  const customerLookupQuery = useQuery<Customer | null>({
    queryKey: ["customer", lookupPhone],
    queryFn: async () => {
      console.log("[CUSTOMER] Customer lookup (functionality not yet implemented in database layer)");
      return null;
    },
    enabled: lookupPhone.replace(/\D/g, "").length >= MIN_PHONE_DIGITS_FOR_LOOKUP,
    staleTime: 0,
    gcTime: 0,
  });

  const saveCustomerMutation = useMutation({
    mutationFn: async (data: {
      phone: string;
      name: string;
      address: string;
      city: string;
      floor: string;
      notes: string;
      businessId: string;
    }) => {
      console.log("[CUSTOMER] Saving customer (functionality not yet implemented in database layer)");
      return data;
    },
  });

  const handlePhoneChange = useCallback((value: string) => {
    setCustomerPhone(value);
    setCustomerAutoFilled(false);
    
    if (phoneLookupTimerRef.current) {
      clearTimeout(phoneLookupTimerRef.current);
    }

    const digits = value.replace(/\D/g, "");
    if (digits.length >= MIN_PHONE_DIGITS_FOR_LOOKUP) {
      // Trigger lookup immediately for complete phone numbers
      setLookupPhone(value);
      console.log("Triggering customer lookup for:", value);
    } else {
      // Clear lookup phone if digits are less than required
      setLookupPhone("");
    }
  }, []);

  const applyCustomerData = useCallback((customer: Customer) => {
    console.log("Applying customer data:", customer.name);
    setCustomerName(customer.name);
    
    if (customer.city) {
      const matchingCity = CITY_OPTIONS.find(
        (opt) => opt.label === customer.city || opt.key === customer.city
      );
      if (matchingCity) {
        setSelectedCityKey(matchingCity.key);
      }
    }
    
    if (customer.address) {
      setDropoffStreet(customer.address);
      setStreetSelectionLocked(true);
    }
    
    if (customer.floor) {
      setFloor(customer.floor);
    }
    
    if (customer.notes) {
      setNotes(customer.notes);
    }
    
    setCustomerAutoFilled(true);
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((e) => {
        console.log("Haptic feedback failed:", e);
      });
    }
  }, []);

  useEffect(() => {
    // Apply customer data whenever we get data from the query
    if (customerLookupQuery.data && lookupPhone && !customerLookupQuery.isFetching) {
      console.log("Customer data received from server:", customerLookupQuery.data);
      applyCustomerData(customerLookupQuery.data);
    }
  }, [customerLookupQuery.data, customerLookupQuery.isFetching, lookupPhone, applyCustomerData]);

  useEffect(() => {
    const timer = phoneLookupTimerRef.current;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  const normalizedStreetInput = useMemo(() => dropoffStreet.replace(/\s+/g, " ").trim(), [dropoffStreet]);
  const streetSearchQuery = useMemo(() => normalizeStreetQuery(normalizedStreetInput), [normalizedStreetInput]);
  const activeCityStreets = useMemo(() => {
    if (!selectedCityKey) {
      return EMPTY_STREET_LIST;
    }
    return streetsStore[selectedCityKey] ?? EMPTY_STREET_LIST;
  }, [selectedCityKey]);
  const isStreetAutocompleteEnabled = activeCityStreets.length > 0;
  const filteredStreetSuggestions = useMemo(() => {
    if (!isStreetAutocompleteEnabled || streetSelectionLocked || streetSearchQuery.length < MIN_STREET_QUERY_LENGTH) {
      return EMPTY_STREET_LIST;
    }
    return searchStreets(activeCityStreets, streetSearchQuery, true);
  }, [activeCityStreets, isStreetAutocompleteEnabled, streetSelectionLocked, streetSearchQuery]);
  const shouldRenderStreetSuggestions = isStreetAutocompleteEnabled && filteredStreetSuggestions.length > 0;
  const streetHelperTitle = selectedCityLabel ? `בחרו רחוב ב${selectedCityLabel}` : "בחרו רחוב יעד";

  const computedDropoffAddress = useMemo(() => {
    const trimmedStreet = dropoffStreet.trim();
    if (!trimmedStreet) {
      return "";
    }
    if (!selectedCityLabel) {
      return trimmedStreet;
    }
    return `${trimmedStreet}, ${selectedCityLabel}`;
  }, [dropoffStreet, selectedCityLabel]);

  const handleDropoffStreetChange = useCallback((value: string) => {
    setDropoffStreet(value);
    setStreetSelectionLocked(false);
  }, []);

  const handleStreetSelect = useCallback(
    (street: string) => {
      const tokens = normalizedStreetInput
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      const numberToken = [...tokens].reverse().find((token) => /\d/.test(token));
      const numberSuffix = numberToken ? ` ${numberToken}` : "";
      const formattedStreet = `${street}${numberSuffix}`.trim();
      setDropoffStreet(formattedStreet);
      setStreetSelectionLocked(true);
      const formattedAddress = selectedCityLabel ? `${formattedStreet}, ${selectedCityLabel}` : formattedStreet;
      console.log("Prefilled dropoff address", formattedAddress);
    },
    [normalizedStreetInput, selectedCityLabel],
  );

  const handleCityPress = useCallback(() => {
    setIsCityPickerOpen((prev) => !prev);
  }, []);

  const handleCitySelect = useCallback((cityKey: StreetCityKey) => {
    setSelectedCityKey(cityKey);
    setIsCityPickerOpen(false);
    setDropoffStreet("");
    setStreetSelectionLocked(false);
    console.log("Selected city", streetCityLabels[cityKey]);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: "https://docs.google.com/uc?export=download&id=18wyLCPRpigCQJowNq9ef4k7uCqpctDP4" },
          { shouldPlay: false }
        );
        if (isActive) {
          soundRef.current = sound;
          setIsSoundLoaded(true);
          console.log("Business notification sound preloaded successfully");
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.log("Business sound preload failed", error);
      }
    };

    if (user?.role === "business") {
      void loadSound();
    }

    return () => {
      isActive = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => {
          console.log("Business sound unload failed", error);
        });
      }
    };
  }, [user?.role]);

  const playBusinessNotificationSound = useCallback(async () => {
    try {
      if (soundRef.current && isSoundLoaded) {
        await soundRef.current.replayAsync();
        console.log("Business notification sound played");
      } else {
        console.log("Business sound not loaded yet, skipping playback");
      }
    } catch (error) {
      console.log("Business sound playback failed", error);
    }
  }, [isSoundLoaded]);

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [router, user]);

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDropoffStreet("");
    setNotes("");
    setPreparationTime(null);
    setStreetSelectionLocked(false);
    setFloor("");
    setSelectedCityKey(null);
    setCustomerAutoFilled(false);
    setLookupPhone("");
    setPaymentMethod("credit");
    setCashAmount("");
  };

  const isFormValid =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    computedDropoffAddress.trim().length > 0 &&
    preparationTime !== null &&
    selectedCityKey !== null;

  const handleCreate = async () => {
    if (!isBusiness || !isFormValid || preparationTime === null) {
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error) => {
        console.log("Create delivery haptics failed", error);
      });
    } else {
      console.log("Create delivery haptic fallback");
    }

    let notesWithFloor = floor.trim() 
      ? `קומה: ${floor.trim()}${notes.trim() ? `\n${notes.trim()}` : ""}`
      : notes.trim();

    if (paymentMethod === "cash" && cashAmount.trim()) {
      const cashNote = `💵 תשלום במזומן: ₪${cashAmount.trim()}`;
      notesWithFloor = notesWithFloor ? `${cashNote}\n${notesWithFloor}` : cashNote;
    } else if (paymentMethod === "cash") {
      const cashNote = `💵 תשלום במזומן`;
      notesWithFloor = notesWithFloor ? `${cashNote}\n${notesWithFloor}` : cashNote;
    }

    const pickupAddress = user.businessProfile?.address || "";
    await createDelivery({
      pickupAddress,
      dropoffAddress: computedDropoffAddress,
      notes: notesWithFloor,
      customerName,
      customerPhone,
      preparationTimeMinutes: preparationTime,
    });

    saveCustomerMutation.mutate(
      {
        phone: customerPhone.trim(),
        name: customerName.trim(),
        address: dropoffStreet.trim(),
        city: selectedCityLabel || "",
        floor: floor.trim(),
        notes: notes.trim(),
        businessId: user.id,
      },
      {
        onSuccess: () => {
          console.log("Customer saved/updated successfully with latest details");
        },
        onError: (error) => {
          console.log("Failed to save customer:", error);
        },
      }
    );

    resetForm();
  };

  const handleOpenTimeModal = useCallback(() => {
    setIsTimeModalVisible(true);
  }, []);

  const handleTimeSelect = useCallback((minutes: number) => {
    setPreparationTime(minutes);
    setIsTimeModalVisible(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsTimeModalVisible(false);
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
    router.push("/my-deliveries");
  }, [newlyTakenDelivery, confirmDelivery, confirmBusinessNotification, router]);

  const courierName = useMemo(() => {
    if (!newlyTakenDelivery?.courierId) {
      return undefined;
    }
    const courier = allUsers.find((u) => u.id === newlyTakenDelivery.courierId);
    return courier?.name;
  }, [newlyTakenDelivery, allUsers]);

  const contentStyle = useMemo(
    () => [styles.container, { paddingTop: 32 + insets.top, paddingBottom: 120 + insets.bottom }],
    [insets.bottom, insets.top],
  );

  if (!isBusiness) {
    return (
      <View style={[styles.blockedContainer, { paddingTop: 64 + insets.top }]} testID="create-delivery-locked">
        <Feather name="lock" size={48} color={Colors.light.tint} />
        <Text style={styles.blockedTitle}>מסך זה זמין לעסקים בלבד</Text>
        <Text style={styles.blockedSubtitle}>
          התחברו כעסק כדי ליצור משלוחים חדשים. שליחים יכולים לראות משלוחים זמינים ולקחת אותם בזמן אמת.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        testID="create-delivery-scroll"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>צור משלוח חדש</Text>
          <Text style={styles.subheading}>מלאו את פרטי המסירה כדי להודיע לשליחים</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>מספר טלפון</Text>
          <View style={styles.phoneInputContainer}>
            <TextInput
              value={customerPhone}
              onChangeText={handlePhoneChange}
              placeholder={fieldPlaceholders.customerPhone}
              placeholderTextColor="#9ba3b8"
              style={[styles.input, styles.phoneInput]}
              textAlign="right"
              keyboardType="phone-pad"
              testID="input-customer-phone"
            />
            {customerLookupQuery.isFetching && (
              <View style={styles.phoneStatusIcon}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
              </View>
            )}
            {customerAutoFilled && !customerLookupQuery.isFetching && (
              <View style={styles.phoneStatusIcon}>
                <UserCheck size={20} color="#10b981" />
              </View>
            )}
          </View>
          {customerAutoFilled && (
            <View style={styles.autoFillBadge}>
              <UserCheck size={14} color="#10b981" />
              <Text style={styles.autoFillBadgeText}>פרטי לקוח הושלמו אוטומטית</Text>
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>שם הלקוח</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder={fieldPlaceholders.customerName}
            placeholderTextColor="#9ba3b8"
            style={styles.input}
            textAlign="right"
            testID="input-customer-name"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>עיר היעד</Text>
          <Pressable
            onPress={handleCityPress}
            style={styles.cityButton}
            testID="city-picker-toggle"
          >
            <View style={styles.cityButtonContent}>
              <Text
                style={selectedCityLabel ? styles.cityButtonText : styles.cityButtonPlaceholder}
              >
                {selectedCityLabel ?? "בחרו עיר יעד"}
              </Text>
              <View style={styles.cityButtonIconWrap}>
                <ChevronDown size={18} color={Colors.light.text} />
              </View>
            </View>
          </Pressable>
          {isCityPickerOpen && (
            <View style={styles.cityPickerCard} testID="city-picker-options">
              {CITY_OPTIONS.map((cityOption) => {
                const isSelected = selectedCityKey === cityOption.key;
                return (
                  <Pressable
                    key={cityOption.key}
                    onPress={() => handleCitySelect(cityOption.key)}
                    style={({ pressed }) => [
                      styles.cityOptionRow,
                      isSelected && styles.cityOptionRowSelected,
                      pressed && styles.cityOptionRowPressed,
                    ]}
                    testID={`city-option-${cityOption.key}`}
                  >
                    <Text style={styles.cityOptionText}>{cityOption.label}</Text>
                    {isSelected && <Feather name="check" size={18} color={Colors.light.tint} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>כתובת יעד</Text>
          <TextInput
            value={dropoffStreet}
            onChangeText={handleDropoffStreetChange}
            placeholder={selectedCityLabel ? "הקלידו רחוב ומספר" : fieldPlaceholders.dropoffAddress}
            placeholderTextColor="#9ba3b8"
            style={styles.input}
            textAlign="right"
            editable={selectedCityKey !== null}
            testID="input-dropoff"
          />

          {shouldRenderStreetSuggestions && (
            <View style={styles.streetHelperCard} testID="city-street-suggestions">
              <View style={styles.streetHelperHeader}>
                <Text style={styles.streetHelperTitle}>{streetHelperTitle}</Text>
                <MapPin size={18} color={Colors.light.tint} />
              </View>

              {filteredStreetSuggestions.map((street) => (
                <Pressable
                  key={street}
                  onPress={() => handleStreetSelect(street)}
                  style={({ pressed }) => [
                    styles.streetSuggestionRow,
                    pressed && styles.streetSuggestionRowPressed,
                  ]}
                  testID={`street-suggestion-${street.replace(/\s+/g, "-")}`}
                >
                  <Text style={styles.streetSuggestionAction}>השלמת כתובת</Text>
                  <Text style={styles.streetSuggestionText}>{street}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>קומה</Text>
          <TextInput
            value={floor}
            onChangeText={setFloor}
            placeholder="למשל: 3"
            placeholderTextColor="#9ba3b8"
            style={styles.input}
            textAlign="right"
            keyboardType="number-pad"
            testID="input-floor"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>הערות לשליח</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={fieldPlaceholders.notes}
            placeholderTextColor="#9ba3b8"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            multiline
            numberOfLines={4}
            testID="input-notes"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>זמן הכנה מינימלי</Text>
          <Pressable
            onPress={handleOpenTimeModal}
            style={[styles.input, styles.timeButton]}
            testID="select-preparation-time"
          >
            <Text style={[styles.timeButtonText, preparationTime === null && styles.placeholderText]}>
              {preparationTime !== null ? `${preparationTime} דקות` : "בחרו זמן הכנה"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>שיטת תשלום</Text>
          <View style={styles.paymentMethodContainer}>
            <Pressable
              onPress={() => setPaymentMethod("credit")}
              style={[
                styles.paymentMethodOption,
                paymentMethod === "credit" && styles.paymentMethodSelected,
              ]}
              testID="payment-method-credit"
            >
              <CreditCard 
                size={20} 
                color={paymentMethod === "credit" ? Colors.light.tint : Colors.light.secondaryText} 
              />
              <Text 
                style={[
                  styles.paymentMethodText,
                  paymentMethod === "credit" && styles.paymentMethodTextSelected,
                ]}
              >
                אשראי / מקוון
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPaymentMethod("cash")}
              style={[
                styles.paymentMethodOption,
                paymentMethod === "cash" && styles.paymentMethodSelected,
              ]}
              testID="payment-method-cash"
            >
              <Banknote 
                size={20} 
                color={paymentMethod === "cash" ? "#059669" : Colors.light.secondaryText} 
              />
              <Text 
                style={[
                  styles.paymentMethodText,
                  paymentMethod === "cash" && styles.paymentMethodTextSelectedCash,
                ]}
              >
                מזומן
              </Text>
            </Pressable>
          </View>
          {paymentMethod === "cash" && (
            <View style={styles.cashAmountContainer}>
              <Text style={styles.cashAmountLabel}>סכום לגבייה (₪)</Text>
              <TextInput
                value={cashAmount}
                onChangeText={setCashAmount}
                placeholder="למשל: 50"
                placeholderTextColor="#9ba3b8"
                style={styles.cashAmountInput}
                textAlign="right"
                keyboardType="numeric"
                testID="input-cash-amount"
              />
            </View>
          )}
        </View>

        <Pressable
          onPress={handleCreate}
          style={[styles.submitButton, (!isFormValid || isLoading) && styles.submitDisabled]}
          disabled={!isFormValid || isLoading}
          testID="create-delivery-button"
        >
          <Text style={styles.submitText}>{isLoading ? "יוצר משלוח..." : "פרסם משלוח"}</Text>
        </Pressable>
      </ScrollView>
      
      <TimeSelectionModal
        visible={isTimeModalVisible}
        onClose={handleCloseModal}
        onSelect={handleTimeSelect}
        title="זמן הכנה מינימלי"
        subtitle="כמה דקות דרושות להכנת ההזמנה?"
      />

      <CourierAssignedBottomSheet
        visible={!!newlyTakenDelivery && !newlyTakenDelivery.businessConfirmed}
        delivery={newlyTakenDelivery}
        courierName={courierName}
        onConfirm={handleConfirmDelivery}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 28,
  },
  headerBlock: {
    alignItems: "flex-end",
    gap: 12,
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
  formGroup: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontSize: 16,
    color: Colors.light.text,
  },
  cityButton: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cityButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cityButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  cityButtonPlaceholder: {
    fontSize: 16,
    color: "#9ba3b8",
    writingDirection: "rtl",
  },
  cityButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cityPickerCard: {
    marginTop: 6,
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cityOptionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  cityOptionRowSelected: {
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  cityOptionRowPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  cityOptionText: {
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  textArea: {
    minHeight: 140,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  timeButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  placeholderText: {
    color: "#9ba3b8",
  },
  streetHelperCard: {
    marginTop: -6,
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  streetHelperHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  streetHelperTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  streetSuggestionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  streetSuggestionRowPressed: {
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  streetSuggestionText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  streetSuggestionAction: {
    fontSize: 13,
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  phoneInputContainer: {
    position: "relative" as const,
  },
  phoneInput: {
    paddingLeft: 48,
  },
  phoneStatusIcon: {
    position: "absolute" as const,
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  autoFillBadge: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
  },
  autoFillBadgeText: {
    fontSize: 13,
    color: "#10b981",
    fontWeight: "600" as const,
    writingDirection: "rtl" as const,
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  submitDisabled: {
    opacity: 0.7,
  },
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 28,
    backgroundColor: Colors.light.background,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "center",
  },
  blockedSubtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: "center",
    writingDirection: "rtl",
    lineHeight: 24,
  },
  paymentMethodContainer: {
    flexDirection: "row-reverse" as const,
    gap: 12,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  paymentMethodSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: "rgba(29, 78, 216, 0.06)",
  },
  paymentMethodText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.secondaryText,
    writingDirection: "rtl" as const,
  },
  paymentMethodTextSelected: {
    color: Colors.light.tint,
  },
  paymentMethodTextSelectedCash: {
    color: "#059669",
  },
  cashAmountContainer: {
    marginTop: 12,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  cashAmountLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#059669",
    textAlign: "right" as const,
    writingDirection: "rtl" as const,
  },
  cashAmountInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontSize: 16,
    color: Colors.light.text,
  },
});
