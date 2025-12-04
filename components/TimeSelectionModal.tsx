import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
} from "react-native";
import { X } from "lucide-react-native";

import Colors from "../constants/colors";

const TIME_OPTIONS = [5, 7, 10, 12, 15, 17, 20, 25] as const;

interface TimeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (minutes: number) => void;
  businessName?: string;
  minTime?: number;
  title?: string;
  subtitle?: string;
}

export function TimeSelectionModal({
  visible,
  onClose,
  onSelect,
  businessName,
  minTime,
  title,
  subtitle,
}: TimeSelectionModalProps) {
  const availableOptions = minTime
    ? TIME_OPTIONS.filter((time) => time >= minTime)
    : TIME_OPTIONS;

  const displayTitle = title ?? "זמן הגעה משוער";
  const displaySubtitle = subtitle ?? "בחרו זמן הגעה משוער לעסק";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="time-selection-modal"
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              testID="close-time-modal"
            >
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{displayTitle}</Text>
          </View>

          {!!businessName && (
            <View style={styles.businessInfo}>
              <Text style={styles.businessLabel}>הגעה ל:</Text>
              <Text style={styles.businessName}>{businessName}</Text>
            </View>
          )}

          {minTime != null && minTime > 0 && (
            <View style={styles.minTimeInfo}>
              <Text style={styles.minTimeText}>
                זמן הכנה מינימלי: {minTime} דקות
              </Text>
            </View>
          )}

          <Text style={styles.subtitle}>{displaySubtitle}</Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.optionsContainer}
          >
            {availableOptions.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={styles.timeOption}
                onPress={() => onSelect(minutes)}
                testID={`time-option-${minutes}`}
              >
                <View style={styles.timeContent}>
                  <Text style={styles.timeValue}>{minutes}</Text>
                  <Text style={styles.timeUnit}>דקות</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    paddingVertical: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
    position: "relative" as const,
  },
  closeButton: {
    position: "absolute" as const,
    left: 24,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    textAlign: "center",
    writingDirection: "rtl",
  },
  businessInfo: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "flex-end",
  },
  businessLabel: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    marginBottom: 4,
    writingDirection: "rtl",
  },
  businessName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  minTimeInfo: {
    backgroundColor: Colors.light.tint,
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  minTimeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
    writingDirection: "rtl",
  },
  scrollView: {
    maxHeight: 400,
  },
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  timeOption: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
    padding: 20,
    alignItems: "center",
  },
  timeContent: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  timeUnit: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
});

export default TimeSelectionModal;
