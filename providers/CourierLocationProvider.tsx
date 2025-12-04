import { useCallback, useEffect, useRef, useState, createContext, useContext, ReactNode } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useDelivery } from "./DeliveryProvider";
import { CourierLocation } from "@/types/models";

type CourierLocationContextValue = {
  currentLocation: CourierLocation | null;
  isTracking: boolean;
  locationError: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
};

const UPDATE_INTERVAL_MS = 10000;

const CourierLocationContext = createContext<CourierLocationContextValue | undefined>(undefined);

const useCourierLocationValue = (): CourierLocationContextValue => {
  const { user } = useDelivery();
  const [currentLocation, setCurrentLocation] = useState<CourierLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const updateLocationMutation = useMutation({
    mutationFn: async (data: { courierId: string; latitude: number; longitude: number }) => {
      console.log("[LOCATION] Updating location (functionality not yet implemented in database layer)");
      return data;
    },
    onSuccess: () => {
      console.log("[LOCATION] Location updated successfully on server");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[LOCATION] Failed to update location on server:", message);
    },
  });

  const sendLocationToServer = useCallback(
    (latitude: number, longitude: number) => {
      if (!user || user.role !== "courier") {
        console.log("[LOCATION] Not a courier, skipping server update");
        return;
      }

      const now = Date.now();
      if (now - lastUpdateTime.current < UPDATE_INTERVAL_MS) {
        console.log("[LOCATION] Throttling server update");
        return;
      }

      lastUpdateTime.current = now;
      console.log("[LOCATION] Sending location to server:", latitude, longitude);
      updateLocationMutation.mutate({
        courierId: user.id,
        latitude,
        longitude,
      });
    },
    [user, updateLocationMutation]
  );

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      const { latitude, longitude } = location.coords;
      const updatedAt = new Date().toISOString();

      console.log("[LOCATION] Received location update:", latitude, longitude);

      setCurrentLocation({
        latitude,
        longitude,
        updatedAt,
      });

      sendLocationToServer(latitude, longitude);
    },
    [sendLocationToServer]
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log("[LOCATION] Requesting foreground permission");
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        console.log("[LOCATION] Permission denied:", status);
        setLocationError("לא ניתנה הרשאה לגישה למיקום");
        return false;
      }

      console.log("[LOCATION] Permission granted");
      setLocationError(null);
      return true;
    } catch (error) {
      console.log("[LOCATION] Error requesting permission:", error);
      setLocationError("שגיאה בבקשת הרשאת מיקום");
      return false;
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (Platform.OS === "web") {
      console.log("[LOCATION] Web platform - using geolocation API");
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const updatedAt = new Date().toISOString();
              setCurrentLocation({ latitude, longitude, updatedAt });
              sendLocationToServer(latitude, longitude);
              setIsTracking(true);
            },
            (error) => {
              console.log("[LOCATION] Web geolocation error:", error.message);
              setLocationError("שגיאה בקבלת המיקום");
            }
          );

          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const updatedAt = new Date().toISOString();
              setCurrentLocation({ latitude, longitude, updatedAt });
              sendLocationToServer(latitude, longitude);
            },
            (error) => {
              console.log("[LOCATION] Web geolocation watch error:", error.message);
            },
            { enableHighAccuracy: true, maximumAge: 10000 }
          );

          locationSubscription.current = {
            remove: () => navigator.geolocation.clearWatch(watchId),
          };
        } else {
          setLocationError("הדפדפן לא תומך במיקום");
        }
      } catch (error) {
        console.log("[LOCATION] Web geolocation setup error:", error);
        setLocationError("שגיאה בהגדרת מעקב מיקום");
      }
      return;
    }

    if (!user || user.role !== "courier") {
      console.log("[LOCATION] Not a courier, cannot start tracking");
      return;
    }

    if (isTracking) {
      console.log("[LOCATION] Already tracking");
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return;
    }

    try {
      console.log("[LOCATION] Starting location tracking");
      
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      handleLocationUpdate(currentPosition);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: UPDATE_INTERVAL_MS,
        },
        handleLocationUpdate
      );

      setIsTracking(true);
      setLocationError(null);
      console.log("[LOCATION] Location tracking started");
    } catch (error) {
      console.log("[LOCATION] Error starting location tracking:", error);
      setLocationError("שגיאה בהפעלת מעקב מיקום");
      setIsTracking(false);
    }
  }, [user, isTracking, requestPermission, handleLocationUpdate, sendLocationToServer]);

  const stopTracking = useCallback(() => {
    console.log("[LOCATION] Stopping location tracking");
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === "web") {
        return;
      }
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(status);
        console.log("[LOCATION] Initial permission status:", status);
      } catch (error) {
        console.log("[LOCATION] Error checking permission:", error);
      }
    };
    checkPermission();
  }, []);

  useEffect(() => {
    if (!user || user.role !== "courier") {
      stopTracking();
      return;
    }

    const isAvailable = user.courierProfile?.isAvailable ?? false;
    if (isAvailable && !isTracking) {
      console.log("[LOCATION] Courier is available, starting tracking");
      startTracking();
    } else if (!isAvailable && isTracking) {
      console.log("[LOCATION] Courier is not available, stopping tracking");
      stopTracking();
    }
  }, [user, isTracking, startTracking, stopTracking]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("[LOCATION] App came to foreground");
        if (user?.role === "courier" && user.courierProfile?.isAvailable && !isTracking) {
          startTracking();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, isTracking, startTracking]);

  useEffect(() => {
    return () => {
      console.log("[LOCATION] Cleanup: stopping tracking");
      stopTracking();
    };
  }, [stopTracking]);

  return {
    currentLocation,
    isTracking,
    locationError,
    startTracking,
    stopTracking,
    permissionStatus,
    requestPermission,
  };
};

export function CourierLocationProvider({ children }: { children: ReactNode }) {
  const value = useCourierLocationValue();
  return <CourierLocationContext.Provider value={value}>{children}</CourierLocationContext.Provider>;
}

export function useCourierLocation(): CourierLocationContextValue {
  const context = useContext(CourierLocationContext);
  if (!context) {
    throw new Error("useCourierLocation must be used within CourierLocationProvider");
  }
  return context;
}
