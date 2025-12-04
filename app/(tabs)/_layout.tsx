import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { BarChart2, ClipboardList, Navigation, PlusCircle, Shield, Wallet } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "../../constants/colors";
import { useDelivery } from "../../providers/DeliveryProvider";
import { GlobalDeliveryNotifications } from "../../components/GlobalDeliveryNotifications";

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isImpersonating, exitImpersonation } = useDelivery();

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [router, user]);

  useEffect(() => {
    if (user?.role === "manager") {
      router.replace("/management-dashboard");
    }
  }, [router, user]);

  const handleExitImpersonation = useCallback(() => {
    console.log("Exiting impersonation from tabs");
    exitImpersonation();
    router.replace("/management-dashboard");
  }, [exitImpersonation, router]);

  if (user?.role === "manager") {
    return null;
  }

  const isCourier = user?.role === "courier";
  const isBusiness = user?.role === "business";

  return (
    <>
      {isImpersonating && (
        <View style={[styles.impersonationBanner, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.impersonationText}>
            צופה כ: {user?.name} ({user?.role === "courier" ? "שליח" : "עסק"})
          </Text>
          <Pressable onPress={handleExitImpersonation} style={styles.exitButton}>
            <Shield color={Colors.light.surface} size={16} />
            <Text style={styles.exitButtonText}>חזרה להנהלה</Text>
          </Pressable>
        </View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.light.tint,
          tabBarInactiveTintColor: Colors.light.tabIconDefault,
          tabBarStyle: {
            backgroundColor: Colors.light.surface,
            borderTopColor: Colors.light.border,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "700",
            writingDirection: "rtl",
          },
          tabBarIconStyle: {
            marginBottom: -4,
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="my-deliveries"
          options={{
            title: "המשלוחים שלי",
            tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="available-deliveries"
          options={{
            title: "משלוחים זמינים",
            tabBarIcon: ({ color }) => <Navigation color={color} size={22} />,
            href: isBusiness ? null : undefined,
          }}
        />
        <Tabs.Screen
          name="my-payments"
          options={{
            title: "התשלומים שלי",
            tabBarIcon: ({ color }) => <Wallet color={color} size={22} />,
            href: isCourier ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="create-delivery"
          options={{
            title: "צור משלוח חדש",
            tabBarIcon: ({ color }) => <PlusCircle color={color} size={22} />,
            href: isCourier ? null : undefined,
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            title: "סטטיסטיקות",
            tabBarIcon: ({ color }) => <BarChart2 color={color} size={22} />,
            href: isCourier ? null : undefined,
          }}
        />
      </Tabs>
      <GlobalDeliveryNotifications />
    </>
  );
}

const styles = StyleSheet.create({
  impersonationBanner: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  impersonationText: {
    flex: 1,
    color: Colors.light.surface,
    fontSize: 14,
    fontWeight: "600",
    writingDirection: "rtl",
  },
  exitButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  exitButtonText: {
    color: Colors.light.surface,
    fontSize: 13,
    fontWeight: "700",
    writingDirection: "rtl",
  },
});
