import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeftRight, Bike, CheckCircle, Clock, FileText, MapPin, Phone, User, Navigation } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import Colors from "../constants/colors";
import { Delivery } from "../types/models";
import { CountdownTimer } from "./CountdownTimer";
import { removeCoordinatesFromAddress, parseAddressCoordinates } from "../utils/distanceCalculator";

const statusLabels: Record<Delivery["status"], string> = {
  waiting: "ממתין",
  taken: "נלקח",
  completed: "הושלם",
};

const statusColors: Record<Delivery["status"], { background: string; color: string }> = {
  waiting: { background: "rgba(37, 99, 235, 0.12)", color: Colors.light.waiting },
  taken: { background: "rgba(245, 158, 11, 0.12)", color: Colors.light.taken },
  completed: { background: "rgba(16, 185, 129, 0.12)", color: Colors.light.completed },
};

type DeliveryCardProps = {
  delivery: Delivery;
  headline?: string;
  businessName?: string;
  courierName?: string;
  courierPhone?: string;
  customerName?: string;
  customerPhone?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => Promise<void> | void;
  onSecondaryAction?: () => Promise<void> | void;
  disabled?: boolean;
  testID?: string;
  showNavigationButtons?: boolean;
  showCustomerInfo?: boolean;
  showCustomerInfoForBusiness?: boolean;
  showNotes?: boolean;
};

export function DeliveryCard({
  delivery,
  headline,
  businessName,
  courierName,
  courierPhone,
  customerName,
  customerPhone,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  disabled = false,
  testID,
  showNavigationButtons = false,
  showCustomerInfo = false,
  showCustomerInfoForBusiness = false,
  showNotes = true,
}: DeliveryCardProps) {
  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(delivery.createdAt));
    } catch (error) {
      console.log("Date formatting failed", error);
      return delivery.createdAt;
    }
  }, [delivery.createdAt]);

  const statusStyle = statusColors[delivery.status];

  const handleAction = async (action?: () => Promise<void> | void) => {
    if (!action) {
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error) => {
        console.log("Action haptic failed", error);
      });
    } else {
      console.log("Action haptic fallback");
    }
    await action();
  };

  const [isCustomerPhoneAvailable, setIsCustomerPhoneAvailable] = useState<boolean>(true);
  const [isCourierPhoneAvailable, setIsCourierPhoneAvailable] = useState<boolean>(true);

  useEffect(() => {
    if (delivery.status === "completed" && delivery.completedAt) {
      const checkAvailability = () => {
        const completedTime = new Date(delivery.completedAt!).getTime();
        const currentTime = Date.now();
        const fiveMinutesInMs = 5 * 60 * 1000;
        const elapsed = currentTime - completedTime;
        
        if (elapsed >= fiveMinutesInMs) {
          setIsCustomerPhoneAvailable(false);
        } else {
          setIsCustomerPhoneAvailable(true);
          const remainingTime = fiveMinutesInMs - elapsed;
          const timer = setTimeout(() => {
            setIsCustomerPhoneAvailable(false);
          }, remainingTime);
          return () => clearTimeout(timer);
        }
      };
      return checkAvailability();
    } else {
      setIsCustomerPhoneAvailable(true);
    }
  }, [delivery.status, delivery.completedAt]);

  useEffect(() => {
    if (delivery.status === "completed" && delivery.completedAt) {
      const checkAvailability = () => {
        const completedTime = new Date(delivery.completedAt!).getTime();
        const currentTime = Date.now();
        const twentyMinutesInMs = 20 * 60 * 1000;
        const elapsed = currentTime - completedTime;
        
        if (elapsed >= twentyMinutesInMs) {
          setIsCourierPhoneAvailable(false);
        } else {
          setIsCourierPhoneAvailable(true);
          const remainingTime = twentyMinutesInMs - elapsed;
          const timer = setTimeout(() => {
            setIsCourierPhoneAvailable(false);
          }, remainingTime);
          return () => clearTimeout(timer);
        }
      };
      return checkAvailability();
    } else {
      setIsCourierPhoneAvailable(true);
    }
  }, [delivery.status, delivery.completedAt]);

  const handlePhoneCall = async (phoneNumber?: string) => {
    const phoneToCall = phoneNumber || courierPhone;
    if (!phoneToCall) {
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
        console.log("Phone call haptic failed", error);
      });
    }
    const phoneUrl = `tel:${phoneToCall}`;
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
        console.log("Phone call initiated", phoneToCall);
      } else {
        console.log("Cannot open phone URL", phoneUrl);
      }
    } catch (error) {
      console.log("Phone call failed", error);
    }
  };

  const handleWazeNavigation = async (address: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error) => {
        console.log("Waze navigation haptic failed", error);
      });
    }
    
    const coords = parseAddressCoordinates(address);
    let wazeUrl: string;
    let wazeWebUrl: string;
    
    if (coords) {
      wazeUrl = `waze://?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
      wazeWebUrl = `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
      console.log("Using coordinates for Waze navigation", coords);
    } else {
      const cleanAddress = removeCoordinatesFromAddress(address);
      wazeUrl = `waze://?q=${encodeURIComponent(cleanAddress)}`;
      wazeWebUrl = `https://waze.com/ul?q=${encodeURIComponent(cleanAddress)}&navigate=yes`;
      console.log("Using address search for Waze navigation", cleanAddress);
    }
    
    try {
      const canOpenWaze = await Linking.canOpenURL(wazeUrl);
      if (canOpenWaze) {
        await Linking.openURL(wazeUrl);
        console.log("Waze navigation opened", address);
      } else {
        console.log("Waze not installed, trying web version");
        await Linking.openURL(wazeWebUrl);
      }
    } catch (error) {
      console.log("Waze navigation failed", error);
    }
  };

  const handleGoogleMapsNavigation = async (address: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error) => {
        console.log("Google Maps navigation haptic failed", error);
      });
    }
    
    const coords = parseAddressCoordinates(address);
    let googleMapsUrl: string;
    
    if (coords) {
      googleMapsUrl = Platform.select({
        ios: `comgooglemaps://?daddr=${coords.latitude},${coords.longitude}&directionsmode=driving`,
        android: `google.navigation:q=${coords.latitude},${coords.longitude}&mode=d`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`,
      }) as string;
      console.log("Using coordinates for Google Maps navigation", coords);
    } else {
      const cleanAddress = removeCoordinatesFromAddress(address);
      googleMapsUrl = Platform.select({
        ios: `comgooglemaps://?q=${encodeURIComponent(cleanAddress)}&directionsmode=driving`,
        android: `google.navigation:q=${encodeURIComponent(cleanAddress)}&mode=d`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddress)}`,
      }) as string;
      console.log("Using address search for Google Maps navigation", cleanAddress);
    }
    
    try {
      const canOpen = await Linking.canOpenURL(googleMapsUrl);
      if (canOpen || Platform.OS === "web") {
        await Linking.openURL(googleMapsUrl);
        console.log("Google Maps navigation opened", address);
      } else {
        console.log("Google Maps not available, trying web version");
        const coords2 = parseAddressCoordinates(address);
        const webUrl = coords2 
          ? `https://www.google.com/maps/dir/?api=1&destination=${coords2.latitude},${coords2.longitude}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(removeCoordinatesFromAddress(address))}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.log("Google Maps navigation failed", error);
    }
  };

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          {headline && businessName ? (
            <Text style={styles.headlineRow} numberOfLines={1}>
              {headline}: <Text style={styles.businessNameHighlight}>{businessName}</Text>
            </Text>
          ) : headline ? (
            <Text style={styles.headline} numberOfLines={1}>
              {headline}
            </Text>
          ) : businessName ? (
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
          ) : null}
          <Text style={styles.statusLabel}>
            משלוח #{delivery.id.slice(-4)}
          </Text>
        </View>
      </View>

      {delivery.status === "completed" ? (
        <View style={styles.completedBadge}>
          <CheckCircle size={16} color={Colors.light.completed} />
          <Text style={styles.completedText}>הושלם</Text>
        </View>
      ) : delivery.pickedUpAt && showNavigationButtons ? (
        <View style={styles.pickedUpSection}>
          <View style={styles.pickedUpBadge}>
            <CheckCircle size={16} color={Colors.light.tint} />
            <Text style={styles.pickedUpText}>נאסף מהמסעדה</Text>
          </View>
          <Pressable
            onPress={() => handleGoogleMapsNavigation(delivery.dropoffAddress)}
            style={styles.googleMapsButton}
            testID={`${testID}-google-maps`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vq5e8qwjldi2tv5helrjf" }}
              style={styles.googleMapsIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            onPress={() => handleWazeNavigation(delivery.dropoffAddress)}
            style={styles.wazeButton}
            testID={`${testID}-waze`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jan9ntdc53j6g5npz8cv5" }}
              style={styles.wazeIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      ) : delivery.pickedUpAt && !showNavigationButtons ? (
        <View style={styles.pickedUpBadge}>
          <CheckCircle size={16} color={Colors.light.tint} />
          <Text style={styles.pickedUpText}>נאסף מהמסעדה</Text>
        </View>
      ) : delivery.businessReady && showNavigationButtons ? (
        <View style={styles.pickedUpSection}>
          <View style={styles.readyBadge}>
            <CheckCircle size={16} color={Colors.light.completed} />
            <Text style={styles.readyText}>ההזמנה מוכנה לאיסוף</Text>
          </View>
          <Pressable
            onPress={() => handleGoogleMapsNavigation(delivery.pickupAddress)}
            style={styles.googleMapsButton}
            testID={`${testID}-google-maps-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vq5e8qwjldi2tv5helrjf" }}
              style={styles.googleMapsIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            onPress={() => handleWazeNavigation(delivery.pickupAddress)}
            style={styles.wazeButton}
            testID={`${testID}-waze-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jan9ntdc53j6g5npz8cv5" }}
              style={styles.wazeIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      ) : delivery.businessReady ? (
        <View style={styles.readyBadge}>
          <CheckCircle size={16} color={Colors.light.completed} />
          <Text style={styles.readyText}>ההזמנה מוכנה לאיסוף</Text>
        </View>
      ) : delivery.businessConfirmed && showNavigationButtons ? (
        <View style={styles.pickedUpSection}>
          <View style={styles.confirmedBadge}>
            <CheckCircle size={16} color={Colors.light.taken} />
            <Text style={styles.confirmedText}>ההזמנה בהכנה</Text>
          </View>
          <Pressable
            onPress={() => handleGoogleMapsNavigation(delivery.pickupAddress)}
            style={styles.googleMapsButton}
            testID={`${testID}-google-maps-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vq5e8qwjldi2tv5helrjf" }}
              style={styles.googleMapsIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            onPress={() => handleWazeNavigation(delivery.pickupAddress)}
            style={styles.wazeButton}
            testID={`${testID}-waze-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jan9ntdc53j6g5npz8cv5" }}
              style={styles.wazeIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      ) : delivery.businessConfirmed ? (
        <View style={styles.confirmedBadge}>
          <CheckCircle size={16} color={Colors.light.taken} />
          <Text style={styles.confirmedText}>ההזמנה בהכנה</Text>
        </View>
      ) : showNavigationButtons && delivery.status === "taken" ? (
        <View style={styles.pickedUpSection}>
          <View style={styles.waitingBusinessBadge}>
            <Clock size={16} color={Colors.light.waiting} />
            <Text style={styles.waitingBusinessText}>ממתין לאישור העסק</Text>
          </View>
          <Pressable
            onPress={() => handleGoogleMapsNavigation(delivery.pickupAddress)}
            style={styles.googleMapsButton}
            testID={`${testID}-google-maps-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vq5e8qwjldi2tv5helrjf" }}
              style={styles.googleMapsIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            onPress={() => handleWazeNavigation(delivery.pickupAddress)}
            style={styles.wazeButton}
            testID={`${testID}-waze-pickup`}
          >
            <Image
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jan9ntdc53j6g5npz8cv5" }}
              style={styles.wazeIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <MapPin size={18} color={Colors.light.tintDark} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>כתובת איסוף</Text>
          <Text style={styles.value} numberOfLines={2}>
            {removeCoordinatesFromAddress(delivery.pickupAddress)}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <ArrowLeftRight size={18} color={Colors.light.tintDark} />
        <View style={styles.rowContent}>
          <Text style={styles.label}>כתובת יעד</Text>
          <Text style={styles.value} numberOfLines={2}>
            {removeCoordinatesFromAddress(delivery.dropoffAddress)}
          </Text>
        </View>
      </View>

      {delivery.distanceKm ? (
        <View style={styles.row}>
          <Navigation size={18} color={Colors.light.tintDark} />
          <View style={styles.rowContent}>
            <Text style={styles.label}>מרחק אווירי</Text>
            <Text style={styles.value}>{delivery.distanceKm} ק״מ</Text>
          </View>
        </View>
      ) : null}

      {showCustomerInfoForBusiness && customerName ? (
        <View style={styles.row}>
          <User size={18} color={Colors.light.tintDark} />
          <View style={styles.rowContent}>
            <Text style={styles.label}>שם הלקוח</Text>
            <Text style={styles.value}>{customerName}</Text>
          </View>
        </View>
      ) : null}

      {showCustomerInfoForBusiness && delivery.notes ? (
        <View style={styles.row}>
          <FileText size={18} color={Colors.light.tintDark} />
          <View style={styles.rowContent}>
            <Text style={styles.label}>הערות</Text>
            <Text style={styles.value} numberOfLines={3}>
              {delivery.notes}
            </Text>
          </View>
        </View>
      ) : null}

      {showCustomerInfoForBusiness && customerPhone ? (
        <Pressable
          onPress={() => handlePhoneCall(customerPhone)}
          style={styles.customerPhoneButton}
          testID={`${testID}-customer-phone-business`}
        >
          <Phone size={18} color="#ffffff" />
          <Text style={styles.customerPhoneText}>חיוג מהיר ללקוח</Text>
        </Pressable>
      ) : null}

      {courierName ? (
        <View style={styles.row}>
          <Bike size={18} color={Colors.light.tintDark} />
          <View style={styles.rowContent}>
            <Text style={styles.label}>שם השליח</Text>
            <Text style={styles.value}>{courierName}</Text>
          </View>
        </View>
      ) : null}

      {courierPhone && (delivery.status === "taken" || (delivery.status === "completed" && isCourierPhoneAvailable)) ? (
        <Pressable
          onPress={() => handlePhoneCall()}
          style={styles.phoneButton}
          testID={`${testID}-phone`}
        >
          <Phone size={18} color="#ffffff" />
          <Text style={styles.phoneButtonText}>חיוג מהיר לשליח</Text>
        </Pressable>
      ) : null}

      {showCustomerInfo && delivery.customerName ? (
        <View style={styles.customerInfoSection}>
          <View style={styles.row}>
            <User size={18} color={Colors.light.tintDark} />
            <View style={styles.rowContent}>
              <Text style={styles.label}>שם הלקוח</Text>
              <Text style={styles.value}>{delivery.customerName}</Text>
            </View>
          </View>
          {delivery.notes && showNotes ? (
            <View style={styles.row}>
              <FileText size={18} color={Colors.light.tintDark} />
              <View style={styles.rowContent}>
                <Text style={styles.label}>הערות</Text>
                <Text style={styles.value} numberOfLines={3}>
                  {delivery.notes}
                </Text>
              </View>
            </View>
          ) : null}
          {delivery.customerPhone && isCustomerPhoneAvailable ? (
            <Pressable
              onPress={() => handlePhoneCall(delivery.customerPhone)}
              style={styles.customerPhoneButton}
              testID={`${testID}-customer-phone`}
            >
              <Phone size={18} color="#ffffff" />
              <Text style={styles.customerPhoneText}>חיוג מהיר ללקוח</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {delivery.confirmedAt && delivery.estimatedArrivalMinutes && delivery.businessConfirmed && !delivery.pickedUpAt ? (
        <CountdownTimer
          confirmedAt={delivery.confirmedAt}
          estimatedArrivalMinutes={delivery.estimatedArrivalMinutes}
          testID={`${testID}-countdown`}
        />
      ) : delivery.estimatedArrivalMinutes && delivery.status === "taken" && !delivery.confirmedAt ? (
        <View style={styles.row}>
          <Clock size={18} color={Colors.light.tintDark} />
          <View style={styles.rowContent}>
            <Text style={styles.label}>זמן הגעה משוער</Text>
            <Text style={styles.value}>{delivery.estimatedArrivalMinutes} דקות</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.timeLabel}>עודכן {formattedDate}</Text>
        <View style={styles.actionsRow}>
          {secondaryActionLabel && onSecondaryAction ? (
            <Pressable
              onPress={() => handleAction(onSecondaryAction)}
              style={[styles.secondaryButton, disabled && styles.disabledButton]}
              disabled={disabled}
              testID={`${testID}-secondary`}
            >
              <Text style={[styles.secondaryText, disabled && styles.disabledText]}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          ) : null}
          {primaryActionLabel && onPrimaryAction ? (
            <Pressable
              onPress={() => handleAction(onPrimaryAction)}
              style={[styles.primaryButton, disabled && styles.disabledButton]}
              disabled={disabled}
              testID={`${testID}-primary`}
            >
              <CheckCircle size={18} color="#ffffff" />
              <Text style={styles.primaryText}>{primaryActionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  titleGroup: {
    alignItems: "center",
    width: "100%",
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  headlineRow: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  courierName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  courierNameHighlight: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F59E0B",
    writingDirection: "rtl",
  },
  businessNameHighlight: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3B82F6",
    writingDirection: "rtl",
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  statusPill: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    writingDirection: "rtl",
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
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  value: {
    fontSize: 16,
    color: Colors.light.text,
    writingDirection: "rtl",
  },

  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeLabel: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  actionsRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "transparent",
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    color: Colors.light.secondaryText,
  },
  confirmedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-end",
  },
  confirmedText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  readyBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-end",
  },
  readyText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.completed,
    writingDirection: "rtl",
  },
  phoneButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    alignSelf: "stretch",
  },
  phoneButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  pickedUpSection: {
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "center",
  },
  pickedUpBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(148, 163, 209, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-end",
  },
  pickedUpText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  wazeButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    width: 56,
    height: 56,
  },
  wazeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  googleMapsButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    width: 56,
    height: 56,
  },
  googleMapsButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  wazeIcon: {
    width: 50,
    height: 50,
  },
  googleMapsIcon: {
    width: 54,
    height: 54,
  },
  customerInfoSection: {
    gap: 12,
  },
  customerPhoneButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#10B981",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    alignSelf: "stretch",
  },
  customerPhoneText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  completedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-end",
  },
  completedText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.completed,
    writingDirection: "rtl",
  },
  waitingBusinessBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-end",
  },
  waitingBusinessText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.waiting,
    writingDirection: "rtl",
  },
});
