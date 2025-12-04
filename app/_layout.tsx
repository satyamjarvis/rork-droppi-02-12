// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { DeliveryProvider } from "../providers/DeliveryProvider";
import { PushNotificationProvider } from "../providers/PushNotificationProvider";
import { CourierLocationProvider } from "../providers/CourierLocationProvider";
import { GlobalDeliveryNotifications } from "../components/GlobalDeliveryNotifications";
import { RealtimeDeliveryNotifications } from "../components/RealtimeDeliveryNotifications";
import { BusinessCreationToast } from "../components/BusinessCreationToast";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "חזרה" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="management-dashboard" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppErrorBoundary>
          <DeliveryProvider>
            <CourierLocationProvider>
              <PushNotificationProvider>
                <RootLayoutNav />
                <GlobalDeliveryNotifications />
                <RealtimeDeliveryNotifications />
                <BusinessCreationToast />
              </PushNotificationProvider>
            </CourierLocationProvider>
          </DeliveryProvider>
        </AppErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
