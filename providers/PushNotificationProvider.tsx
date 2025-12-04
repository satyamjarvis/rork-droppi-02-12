import { useEffect, useRef, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { useDelivery } from "./DeliveryProvider";
import { trpc } from "../lib/trpc";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") {
    console.log("[PUSH] Push notifications not supported on web");
    return null;
  }

  if (!Device.isDevice) {
    console.log("[PUSH] Push notifications require a physical device");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[PUSH] Permission not granted for push notifications");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    let tokenData;
    
    if (projectId) {
      console.log("[PUSH] Using projectId:", projectId);
      tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
    } else {
      console.log("[PUSH] No projectId found, using experienceId for Expo Go");
      const experienceId = `@${Constants.expoConfig?.owner ?? 'anonymous'}/${Constants.expoConfig?.slug ?? 'app'}`;
      console.log("[PUSH] experienceId:", experienceId);
      tokenData = await Notifications.getExpoPushTokenAsync();
    }

    console.log("[PUSH] Push token obtained:", tokenData.data.substring(0, 30) + "...");

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });
    }

    return tokenData.data;
  } catch (error) {
    console.log("[PUSH] Error getting push token:", error);
    return null;
  }
}

type PushNotificationProviderProps = {
  children: ReactNode;
};

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user } = useDelivery();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const tokenRegistered = useRef<boolean>(false);

  const registerPushTokenMutation = trpc.users.registerPushToken.useMutation({
    onSuccess: () => {
      console.log("[PUSH] Push token registered successfully on server");
      tokenRegistered.current = true;
    },
    onError: (error) => {
      console.log("[PUSH] Failed to register push token on server:", error.message);
    },
  });

  const registerToken = useCallback(async () => {
    if (!user || tokenRegistered.current) {
      return;
    }

    if (user.role !== "courier") {
      console.log("[PUSH] Skipping push token registration for non-courier user");
      return;
    }

    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      console.log("[PUSH] Registering push token for user:", user.id);
      registerPushTokenMutation.mutate({
        userId: user.id,
        pushToken: token,
      });
    }
  }, [user, registerPushTokenMutation]);

  useEffect(() => {
    if (user?.role === "courier") {
      registerToken();
    }
  }, [user, registerToken]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log("[PUSH] Notification received in foreground:", notification.request.content.title);
      console.log("[PUSH] Notification body:", notification.request.content.body);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      console.log("[PUSH] Notification response received");
      const data = response.notification.request.content.data;
      
      if (data?.type === "new_delivery" && data?.deliveryId) {
        console.log("[PUSH] Navigating to available deliveries");
        router.push("/(tabs)/available-deliveries");
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  useEffect(() => {
    if (!user) {
      tokenRegistered.current = false;
    }
  }, [user]);

  return <>{children}</>;
}
