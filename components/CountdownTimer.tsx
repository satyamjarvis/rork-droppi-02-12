import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Clock } from "lucide-react-native";

import Colors from "../constants/colors";

type CountdownTimerProps = {
  confirmedAt: string;
  estimatedArrivalMinutes: number;
  testID?: string;
};

export function CountdownTimer({ confirmedAt, estimatedArrivalMinutes, testID }: CountdownTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    const calculateRemaining = () => {
      const confirmedTime = new Date(confirmedAt).getTime();
      const arrivalTime = confirmedTime + estimatedArrivalMinutes * 60 * 1000;
      const now = Date.now();
      const diff = Math.max(0, Math.floor((arrivalTime - now) / 1000));
      return diff;
    };

    setRemainingSeconds(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmedAt, estimatedArrivalMinutes]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const isLowTime = remainingSeconds < 300;
  const isExpired = remainingSeconds === 0;

  return (
    <View style={[styles.container, isExpired && styles.expiredContainer]} testID={testID}>
      <Clock size={18} color={isExpired ? "#ef4444" : isLowTime ? "#f59e0b" : Colors.light.tint} />
      <View style={styles.textContainer}>
        <Text style={styles.label}>זמן הגעה משוער</Text>
        <Text style={[styles.timer, isExpired && styles.expiredText, isLowTime && !isExpired && styles.lowTimeText]}>
          {isExpired ? "הזמן עבר" : `${minutes}:${seconds.toString().padStart(2, "0")}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(148, 163, 209, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  expiredContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  timer: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "ltr",
  },
  expiredText: {
    color: "#ef4444",
    writingDirection: "rtl",
  },
  lowTimeText: {
    color: "#f59e0b",
  },
});
