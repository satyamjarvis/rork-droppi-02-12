import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart2, Calendar, ChevronDown, TrendingUp } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";

import Colors from "../../constants/colors";
import { useDelivery } from "../../providers/DeliveryProvider";


type TimeRange = "hourly" | "daily" | "weekly" | "monthly" | "custom";

type ChartDataPoint = {
  label: string;
  value: number;
  date: Date;
};

const TIME_RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "hourly", label: "לפי שעה" },
  { key: "daily", label: "לפי יום" },
  { key: "weekly", label: "לפי שבוע" },
  { key: "monthly", label: "לפי חודש" },
  { key: "custom", label: "טווח זמן מותאם אישית" },
];



const formatHour = (date: Date): string => {
  const hour = date.getHours();
  return `${hour.toString().padStart(2, "0")}:00`;
};

const formatDay = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
};

const formatWeek = (date: Date): string => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  return `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;
};

const formatMonth = (date: Date): string => {
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return months[date.getMonth()] ?? "";
};

const getHourKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
};

const getDayKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getWeekKey = (date: Date): string => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  return `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
};

const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}`;
};

const generateTimeSlots = (
  timeRange: TimeRange,
  startDate: Date,
  endDate: Date
): { key: string; label: string; date: Date }[] => {
  const slots: { key: string; label: string; date: Date }[] = [];
  const current = new Date(startDate);

  switch (timeRange) {
    case "hourly":
      while (current <= endDate) {
        slots.push({
          key: getHourKey(current),
          label: formatHour(current),
          date: new Date(current),
        });
        current.setHours(current.getHours() + 1);
      }
      break;
    case "daily":
      while (current <= endDate) {
        slots.push({
          key: getDayKey(current),
          label: formatDay(current),
          date: new Date(current),
        });
        current.setDate(current.getDate() + 1);
      }
      break;
    case "weekly":
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      current.setDate(diff);
      while (current <= endDate) {
        slots.push({
          key: getWeekKey(current),
          label: formatWeek(current),
          date: new Date(current),
        });
        current.setDate(current.getDate() + 7);
      }
      break;
    case "monthly":
      current.setDate(1);
      while (current <= endDate) {
        slots.push({
          key: getMonthKey(current),
          label: formatMonth(current),
          date: new Date(current),
        });
        current.setMonth(current.getMonth() + 1);
      }
      break;
    case "custom":
      while (current <= endDate) {
        slots.push({
          key: getDayKey(current),
          label: formatDay(current),
          date: new Date(current),
        });
        current.setDate(current.getDate() + 1);
      }
      break;
  }

  return slots;
};

type WebCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
};

const WebCalendar = ({ selectedDate, onSelectDate, minDate, maxDate }: WebCalendarProps) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const dayNames = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const isDateDisabled = (day: number): boolean => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
      return true;
    }
    if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
      return true;
    }
    return false;
  };

  const isDateSelected = (day: number): boolean => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    );
  };

  const handleDayPress = (day: number) => {
    if (!isDateDisabled(day)) {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      onSelectDate(newDate);
    }
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <View style={calendarStyles.container}>
      <View style={calendarStyles.header}>
        <Pressable onPress={goToNextMonth} style={calendarStyles.navButton}>
          <Text style={calendarStyles.navButtonText}>▶</Text>
        </Pressable>
        <Text style={calendarStyles.monthYearText}>
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </Text>
        <Pressable onPress={goToPrevMonth} style={calendarStyles.navButton}>
          <Text style={calendarStyles.navButtonText}>◀</Text>
        </Pressable>
      </View>
      <View style={calendarStyles.daysHeader}>
        {dayNames.map((dayName, index) => (
          <Text key={index} style={calendarStyles.dayHeaderText}>{dayName}</Text>
        ))}
      </View>
      <View style={calendarStyles.daysGrid}>
        {days.map((day, index) => (
          <Pressable
            key={index}
            onPress={() => day && handleDayPress(day)}
            style={[
              calendarStyles.dayCell,
              day && isDateSelected(day) && calendarStyles.selectedDayCell,
              day && isDateDisabled(day) && calendarStyles.disabledDayCell,
            ]}
            disabled={!day || isDateDisabled(day)}
          >
            {day && (
              <Text
                style={[
                  calendarStyles.dayText,
                  isDateSelected(day) && calendarStyles.selectedDayText,
                  isDateDisabled(day) && calendarStyles.disabledDayText,
                ]}
              >
                {day}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const calendarStyles = StyleSheet.create({
  container: {
    width: 280,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 14,
    color: Colors.light.tint,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  daysHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  dayHeaderText: {
    width: 36,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  selectedDayCell: {
    backgroundColor: Colors.light.tint,
  },
  disabledDayCell: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  selectedDayText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledDayText: {
    color: Colors.light.secondaryText,
  },
});

const getDefaultDateRange = (timeRange: TimeRange): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();

  switch (timeRange) {
    case "hourly":
      start.setHours(now.getHours() - 23);
      break;
    case "daily":
      start.setDate(now.getDate() - 6);
      break;
    case "weekly":
      start.setDate(now.getDate() - 28);
      break;
    case "monthly":
      start.setMonth(now.getMonth() - 11);
      break;
    case "custom":
      start.setDate(now.getDate() - 6);
      break;
  }

  return { start, end: now };
};

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { user, deliveries, isLoading } = useDelivery();
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [isTimeRangePickerOpen, setIsTimeRangePickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const isBusiness = user?.role === "business";

  const businessDeliveries = useMemo(() => {
    if (!user || user.role !== "business") {
      return [];
    }
    return deliveries.filter((d) => d.businessId === user.id);
  }, [deliveries, user]);

  const chartData = useMemo((): ChartDataPoint[] => {
    const dateRange = timeRange === "custom" 
      ? { start: customStartDate, end: customEndDate }
      : getDefaultDateRange(timeRange);
    
    const slots = generateTimeSlots(timeRange, dateRange.start, dateRange.end);
    const countMap = new Map<string, number>();

    slots.forEach((slot) => {
      countMap.set(slot.key, 0);
    });

    businessDeliveries.forEach((delivery) => {
      const deliveryDate = new Date(delivery.createdAt);
      if (deliveryDate < dateRange.start || deliveryDate > dateRange.end) {
        return;
      }

      let key: string;
      switch (timeRange) {
        case "hourly":
          key = getHourKey(deliveryDate);
          break;
        case "daily":
        case "custom":
          key = getDayKey(deliveryDate);
          break;
        case "weekly":
          key = getWeekKey(deliveryDate);
          break;
        case "monthly":
          key = getMonthKey(deliveryDate);
          break;
        default:
          key = getDayKey(deliveryDate);
      }

      const current = countMap.get(key) ?? 0;
      countMap.set(key, current + 1);
    });

    return slots.map((slot) => ({
      label: slot.label,
      value: countMap.get(slot.key) ?? 0,
      date: slot.date,
    }));
  }, [businessDeliveries, timeRange, customStartDate, customEndDate]);

  const maxValue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.value), 1);
    return Math.ceil(max * 1.2);
  }, [chartData]);

  const totalDeliveries = useMemo(() => {
    return chartData.reduce((sum, point) => sum + point.value, 0);
  }, [chartData]);

  

  const handleTimeRangePress = useCallback(() => {
    setIsTimeRangePickerOpen((prev) => !prev);
  }, []);

  const handleTimeRangeSelect = useCallback((range: TimeRange) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setTimeRange(range);
    setIsTimeRangePickerOpen(false);
  }, []);

  const handleStartDateChange = useCallback((_: unknown, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selectedDate) {
      setCustomStartDate(selectedDate);
    }
  }, []);

  const handleEndDateChange = useCallback((_: unknown, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selectedDate) {
      setCustomEndDate(selectedDate);
    }
  }, []);

  const selectedRangeLabel = useMemo(() => {
    return TIME_RANGE_OPTIONS.find((opt) => opt.key === timeRange)?.label ?? "בחר טווח";
  }, [timeRange]);

  const visibleDataPoints = useMemo(() => {
    const maxPoints = timeRange === "hourly" ? 24 : timeRange === "monthly" ? 12 : 7;
    let data = chartData;
    if (chartData.length > maxPoints) {
      data = chartData.slice(-maxPoints);
    }
    return [...data].reverse();
  }, [chartData, timeRange]);





  if (!isBusiness) {
    return (
      <View style={[styles.blockedContainer, { paddingTop: 64 + insets.top }]} testID="statistics-locked">
        <BarChart2 size={48} color={Colors.light.tint} />
        <Text style={styles.blockedTitle}>מסך זה זמין לעסקים בלבד</Text>
        <Text style={styles.blockedSubtitle}>
          התחברו כעסק כדי לצפות בסטטיסטיקות המשלוחים שלכם.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: 32 + insets.top, paddingBottom: 100 + insets.bottom },
      ]}
      testID="statistics-screen"
    >
      <View style={styles.headerBlock}>
        <Text style={styles.heading}>סטטיסטיקות</Text>
        <Text style={styles.subheading}>צפייה בנתוני המשלוחים שלך לפי זמן</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>טווח זמן</Text>
        <Pressable
          onPress={handleTimeRangePress}
          style={styles.timeRangeButton}
          testID="time-range-picker-toggle"
        >
          <View style={styles.timeRangeButtonContent}>
            <Text style={styles.timeRangeButtonText}>{selectedRangeLabel}</Text>
            <View style={styles.timeRangeButtonIconWrap}>
              <ChevronDown size={18} color={Colors.light.text} />
            </View>
          </View>
        </Pressable>

        {isTimeRangePickerOpen && (
          <View style={styles.timeRangePickerCard} testID="time-range-options">
            {TIME_RANGE_OPTIONS.map((option) => {
              const isSelected = timeRange === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => handleTimeRangeSelect(option.key)}
                  style={({ pressed }) => [
                    styles.timeRangeOptionRow,
                    isSelected && styles.timeRangeOptionRowSelected,
                    pressed && styles.timeRangeOptionRowPressed,
                  ]}
                  testID={`time-range-option-${option.key}`}
                >
                  <Text style={styles.timeRangeOptionText}>{option.label}</Text>
                  {isSelected && <Calendar size={18} color={Colors.light.tint} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {timeRange === "custom" && (
          <View style={styles.customDateContainer}>
            <View style={styles.datePickerRow}>
              <Text style={styles.dateLabel}>מתאריך:</Text>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                style={styles.dateButton}
                testID="start-date-button"
              >
                <Text style={styles.dateButtonText}>{formatDay(customStartDate)}</Text>
              </Pressable>
            </View>
            <View style={styles.datePickerRow}>
              <Text style={styles.dateLabel}>עד תאריך:</Text>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                style={styles.dateButton}
                testID="end-date-button"
              >
                <Text style={styles.dateButtonText}>{formatDay(customEndDate)}</Text>
              </Pressable>
            </View>
            {showStartPicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={customStartDate}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
                maximumDate={customEndDate}
                testID="start-date-picker"
              />
            )}
            {showEndPicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={customEndDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
                minimumDate={customStartDate}
                maximumDate={new Date()}
                testID="end-date-picker"
              />
            )}
            {Platform.OS === "web" && (showStartPicker || showEndPicker) && (
              <Modal
                visible={showStartPicker || showEndPicker}
                transparent
                animationType="fade"
                onRequestClose={() => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Pressable
                  style={styles.calendarModalOverlay}
                  onPress={() => {
                    setShowStartPicker(false);
                    setShowEndPicker(false);
                  }}
                >
                  <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.calendarModalTitle}>
                      {showStartPicker ? "בחר תאריך התחלה" : "בחר תאריך סיום"}
                    </Text>
                    <WebCalendar
                      selectedDate={showStartPicker ? customStartDate : customEndDate}
                      onSelectDate={(date) => {
                        if (showStartPicker) {
                          if (date <= customEndDate) {
                            setCustomStartDate(date);
                          }
                          setShowStartPicker(false);
                        } else {
                          if (date >= customStartDate && date <= new Date()) {
                            setCustomEndDate(date);
                          }
                          setShowEndPicker(false);
                        }
                      }}
                      minDate={showEndPicker ? customStartDate : undefined}
                      maxDate={showStartPicker ? customEndDate : new Date()}
                    />
                    <Pressable
                      style={styles.calendarCloseButton}
                      onPress={() => {
                        setShowStartPicker(false);
                        setShowEndPicker(false);
                      }}
                    >
                      <Text style={styles.calendarCloseButtonText}>סגור</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </Modal>
            )}
          </View>
        )}
      </View>

      <View style={styles.statsCards}>
        <View style={styles.statCard}>
          <TrendingUp size={24} color={Colors.light.tint} />
          <Text style={styles.statValue}>{totalDeliveries}</Text>
          <Text style={styles.statLabel}>סהכ משלוחים</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>טוען נתונים...</Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>כמות משלוחים</Text>
          </View>
          
          {visibleDataPoints.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>אין נתונים לתקופה זו</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.horizontalChartScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {visibleDataPoints.map((point, index) => {
                const barWidthPercent = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                return (
                  <View key={`${point.label}-${index}`} style={styles.horizontalBarRow}>
                    <View style={styles.horizontalLabelContainer}>
                      <Text style={styles.horizontalLabel} numberOfLines={1}>
                        {point.label}
                      </Text>
                    </View>
                    <View style={styles.horizontalBarContainer}>
                      <View style={styles.horizontalBarBackground}>
                        <View 
                          style={[
                            styles.horizontalBar, 
                            { width: `${Math.max(barWidthPercent, point.value > 0 ? 3 : 0)}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.horizontalBarValue}>
                        {point.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  headerBlock: {
    alignItems: "flex-end",
    gap: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  subheading: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  filterSection: {
    gap: 10,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timeRangeButton: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  timeRangeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeRangeButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  timeRangeButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRangePickerCard: {
    marginTop: 6,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
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
  timeRangeOptionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  timeRangeOptionRowSelected: {
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  timeRangeOptionRowPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  timeRangeOptionText: {
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  customDateContainer: {
    marginTop: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  datePickerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  dateButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dateButtonText: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "600",
  },
  statsCards: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 12,
  },
  statCard: {
    minWidth: 140,
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    textAlign: "center",
    writingDirection: "rtl",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  chartContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  horizontalChartScroll: {
    maxHeight: 400,
  },
  horizontalBarRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.15)",
  },
  horizontalLabelContainer: {
    width: 70,
    paddingLeft: 12,
  },
  horizontalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "right",
  },
  horizontalBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  horizontalBarBackground: {
    flex: 1,
    height: 28,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderRadius: 8,
    overflow: "hidden",
  },
  horizontalBar: {
    height: "100%",
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    minWidth: 4,
  },
  horizontalBarValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.tint,
    minWidth: 36,
    textAlign: "left",
  },
  chartHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  noDataContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
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
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarModalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: "center",
    writingDirection: "rtl",
  },
  calendarCloseButton: {
    marginTop: 20,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  calendarCloseButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
});
