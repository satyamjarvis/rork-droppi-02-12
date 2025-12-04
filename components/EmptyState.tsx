import { StyleSheet, Text, View } from "react-native";
import { Compass } from "lucide-react-native";

import Colors from "../constants/colors";

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  testID?: string;
};

export function EmptyState({ title, subtitle, testID }: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconWrapper}>
        <Compass size={32} color={Colors.light.tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  iconWrapper: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "center",
    writingDirection: "rtl",
    paddingHorizontal: 24,
  },
});
