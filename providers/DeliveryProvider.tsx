import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext, ReactNode } from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";

import { Delivery, DeliveryStatus, User, UserRole } from "../types/models";
import { useQuery } from "@tanstack/react-query";
import { getUsers, getDeliveries } from "../lib/supabaseQueries";
import { persistentStorage } from "../utils/persistentStorage";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

type LoginPayload = {
  phone: string;
  password: string;
};

type CreateDeliveryPayload = {
  pickupAddress: string;
  dropoffAddress: string;
  notes: string;
  customerName: string;
  customerPhone: string;
  preparationTimeMinutes: number;
};

type ManagerUpdateDeliveryPayload = {
  deliveryId: string;
  status?: DeliveryStatus;
  courierId?: string | null;
};

type ManagerRegisterCourierPayload = {
  name: string;
  age: number;
  phone: string;
  email: string;
  vehicle: string;
  password: string;
  idNumber?: string;
};

type ManagerRegisterBusinessPayload = {
  name: string;
  address: string;
  phone: string;
  email: string;
  password: string;
};

type ManagerRegisterManagerPayload = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type ManagerUpdateUserPayload = {
  userId: string;
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  courierProfile?: {
    age?: number;
    vehicle?: string;
    email?: string;
  };
  businessProfile?: {
    address?: string;
    email?: string;
  };
};

type DeliveryContextValue = {
  user: User | null;
  deliveries: Delivery[];
  allUsers: User[];
  isLoading: boolean;
  loginMutationStatus: "idle" | "pending" | "success" | "error";
  createDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  takeDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  pickupDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  completeDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  confirmDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  markReadyMutationStatus: "idle" | "pending" | "success" | "error";
  managerUpdateDeliveryMutationStatus: "idle" | "pending" | "success" | "error";
  managerRegisterCourierMutationStatus: "idle" | "pending" | "success" | "error";
  managerRegisterBusinessMutationStatus: "idle" | "pending" | "success" | "error";
  managerRegisterManagerMutationStatus: "idle" | "pending" | "success" | "error";
  managerUpdateUserMutationStatus: "idle" | "pending" | "success" | "error";
  updateAvailabilityMutationStatus: "idle" | "pending" | "success" | "error";
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => void;
  createDelivery: (payload: CreateDeliveryPayload) => Promise<Delivery>;
  takeDelivery: (deliveryId: string, estimatedArrivalMinutes: number) => Promise<Delivery>;
  pickupDelivery: (deliveryId: string) => Promise<Delivery>;
  completeDelivery: (deliveryId: string) => Promise<Delivery>;
  confirmDelivery: (deliveryId: string) => Promise<Delivery>;
  markReady: (deliveryId: string) => Promise<Delivery>;
  managerUpdateDelivery: (payload: ManagerUpdateDeliveryPayload) => Promise<Delivery>;
  managerRegisterCourier: (payload: ManagerRegisterCourierPayload) => Promise<User>;
  managerRegisterBusiness: (payload: ManagerRegisterBusinessPayload) => Promise<User>;
  managerRegisterManager: (payload: ManagerRegisterManagerPayload) => Promise<User>;
  managerUpdateUser: (payload: ManagerUpdateUserPayload) => Promise<User>;
  updateAvailability: (isAvailable: boolean) => Promise<User>;
  getDeliveriesForUser: (role: UserRole, userId: string) => Delivery[];
  getAvailableDeliveries: () => Delivery[];
  dismissedDeliveryIds: Set<string>;
  dismissDelivery: (deliveryId: string) => void;
  confirmedBusinessDeliveryIds: Set<string>;
  confirmBusinessNotification: (deliveryId: string) => void;
  businessCreationMessage: string | null;
  clearBusinessCreationMessage: () => void;
  courierAssignmentMessage: string | null;
  clearCourierAssignmentMessage: () => void;
  isImpersonating: boolean;
  originalManagerUser: User | null;
  impersonateUser: (targetUser: User) => void;
  exitImpersonation: () => void;
};

const USER_STORAGE_KEY = "droppi:currentUser";
const IMPERSONATION_KEY = "droppi:impersonation";

const normalizeValueForSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeValueForSignature);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeValueForSignature((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
};

const createStableSignature = (value: unknown): string => {
  const normalized = normalizeValueForSignature(value);
  const serialized = JSON.stringify(normalized);
  return serialized ?? "undefined";
};

const queryRefetchInterval = 5000;

const DeliveryContext = createContext<DeliveryContextValue | undefined>(undefined);

const useDeliveryContextValue = (): DeliveryContextValue => {
  const [user, setUser] = useState<User | null>(null);
  const [dismissedDeliveryIds, setDismissedDeliveryIds] = useState<Set<string>>(new Set());
  const [confirmedBusinessDeliveryIds, setConfirmedBusinessDeliveryIds] = useState<Set<string>>(new Set());
  const [businessCreationMessage, setBusinessCreationMessage] = useState<string | null>(null);
  const [courierAssignmentMessage, setCourierAssignmentMessage] = useState<string | null>(null);
  const [originalManagerUser, setOriginalManagerUser] = useState<User | null>(null);

  const userSnapshotRef = useRef<string>(createStableSignature(null));
  const hydrationCompletedRef = useRef<boolean>(false);

  const applyUserState = useCallback((nextUser: User | null) => {
    const signature = createStableSignature(nextUser);
    if (userSnapshotRef.current === signature) {
      console.log("User state unchanged, skipping apply", signature.length);
      return;
    }
    userSnapshotRef.current = signature;
    setUser(nextUser);
    console.log("User state applied", nextUser?.id ?? "none");
  }, [setUser]);

  const persistUserSafely = useCallback(async (nextUser: User | null) => {
    try {
      if (nextUser) {
        await persistentStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
        console.log("Persisted user stored", nextUser.id);
      } else {
        await persistentStorage.removeItem(USER_STORAGE_KEY);
        console.log("Persisted user cleared");
      }
    } catch (error) {
      console.log("Persisted user write failed", error);
    }
  }, []);

  const {
    data: usersData,
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: queryRefetchInterval,
  });

  const {
    data: deliveriesData,
    isLoading: isDeliveriesLoading,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: ["deliveries"],
    queryFn: getDeliveries,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: queryRefetchInterval,
  });

  useEffect(() => {
    let isActive = true;
    Promise.all([
      persistentStorage.getItem(USER_STORAGE_KEY),
      persistentStorage.getItem(IMPERSONATION_KEY),
    ])
      .then(([stored, impersonationStored]) => {
        if (!isActive) {
          return;
        }
        if (impersonationStored) {
          try {
            const parsedImpersonation = JSON.parse(impersonationStored);
            if (parsedImpersonation && typeof parsedImpersonation === "object" && parsedImpersonation.id) {
              setOriginalManagerUser(parsedImpersonation as User);
              console.log("Impersonation state restored", parsedImpersonation.id);
            } else {
              console.log("Impersonation data invalid, clearing");
              persistentStorage.removeItem(IMPERSONATION_KEY).catch((removeError) => {
                console.log("Impersonation cleanup failed", removeError);
              });
            }
          } catch (error) {
            console.log("Impersonation parse failed", error);
            persistentStorage.removeItem(IMPERSONATION_KEY).catch((removeError) => {
              console.log("Impersonation cleanup failed", removeError);
            });
          }
        }
        if (!stored) {
          console.log("No persisted user found in storage");
          return;
        }
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object" && parsed.id) {
            applyUserState(parsed as User);
            console.log("Persisted user restored", parsed.id);
          } else {
            console.log("Persisted user data invalid, clearing");
            persistentStorage.removeItem(USER_STORAGE_KEY).catch((removeError) => {
              console.log("Persisted user cleanup failed", removeError);
            });
          }
        } catch (error) {
          console.log("Persisted user parse failed", error);
          persistentStorage.removeItem(USER_STORAGE_KEY).catch((removeError) => {
            console.log("Persisted user cleanup failed", removeError);
          });
        }
      })
      .finally(() => {
        if (isActive) {
          hydrationCompletedRef.current = true;
          console.log("User hydration completed");
        }
      });
    return () => {
      isActive = false;
    };
  }, [applyUserState]);

  const appStateRef = useRef<AppStateStatus>("active");

  useEffect(() => {
    if (Platform.OS === "web") {
      console.log("AppState listener skipped on web platform");
      return undefined;
    }

    if (!AppState.addEventListener) {
      console.log("AppState listener unavailable on this platform");
      return undefined;
    }

    const handleChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current !== "active" && nextAppState === "active") {
        console.log("App state active, refreshing queries");
        refetchUsers().catch((error) => {
          console.log("Users refetch failed", error);
        });
        refetchDeliveries().catch((error) => {
          console.log("Deliveries refetch failed", error);
        });
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleChange);

    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      }
    };
  }, [refetchDeliveries, refetchUsers]);

  const {
    mutateAsync: loginMutateAsync,
    status: loginStatus,
  } = trpc.auth.login.useMutation({
    onSuccess: (foundUser) => {
      console.log("Login success", foundUser.id);
      applyUserState(foundUser);
      void persistUserSafely(foundUser);
    },
    onError: (error) => {
      console.log("Login failed", error);
    },
  });

  const {
    mutateAsync: createDeliveryMutateAsync,
    status: createDeliveryStatus,
  } = trpc.business.createDelivery.useMutation({
    onSuccess: (createdDelivery) => {
      console.log("Delivery created", createdDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [createdDelivery];
        }
        return [createdDelivery, ...current];
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setBusinessCreationMessage("מצוין!\nמשלוח חדש נוסף למערכת✅");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "יצירת המשלוח נכשלה";
      console.log("Create delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: takeDeliveryMutateAsync,
    status: takeDeliveryStatus,
  } = trpc.courier.takeDelivery.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Delivery taken", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setCourierAssignmentMessage("המשלוח שויך אלייך בהצלחה.\nסע בזהירות!");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "לא ניתן לקחת את המשלוח";
      console.log("Take delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: pickupDeliveryMutateAsync,
    status: pickupDeliveryStatus,
  } = trpc.courier.pickupDelivery.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Delivery picked up", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setCourierAssignmentMessage("המשלוח נאסף בהצלחה.\nסע בזהירות!");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "לא ניתן לאסוף את המשלוח";
      console.log("Pickup delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: completeDeliveryMutateAsync,
    status: completeDeliveryStatus,
  } = trpc.courier.completeDelivery.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Delivery completed", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setCourierAssignmentMessage("המשלוח הושלם בהצלחה\nכל הכבוד!💯");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "לא ניתן להשלים את המשלוח";
      console.log("Complete delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: managerRegisterCourierMutateAsync,
    status: managerRegisterCourierMutationStatus,
  } = trpc.manager.registerCourier.useMutation({
    onSuccess: (createdCourier) => {
      console.log("Manager registered courier", createdCourier.id);
      utils.users.list.setData(undefined, (current) => {
        if (!current) {
          return [createdCourier];
        }
        return [createdCourier, ...current];
      });
      utils.users.list.invalidate().catch((invalidateError) => {
        console.log("Users invalidate failed", invalidateError);
      });
      Alert.alert("הצלחה", "שליח חדש נרשם עם הסיסמה שבחרת");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "יצירת השליח נכשלה";
      console.log("Register courier failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: managerRegisterBusinessMutateAsync,
    status: managerRegisterBusinessMutationStatus,
  } = trpc.manager.registerBusiness.useMutation({
    onSuccess: (createdBusiness) => {
      console.log("Manager registered business", createdBusiness.id);
      utils.users.list.setData(undefined, (current) => {
        if (!current) {
          return [createdBusiness];
        }
        return [createdBusiness, ...current];
      });
      utils.users.list.invalidate().catch((invalidateError) => {
        console.log("Users invalidate failed", invalidateError);
      });
      Alert.alert("הצלחה", "עסק חדש נרשם עם הסיסמה שבחרת");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "יצירת העסק נכשלה";
      console.log("Register business failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: managerRegisterManagerMutateAsync,
    status: managerRegisterManagerMutationStatus,
  } = trpc.manager.registerManager.useMutation({
    onSuccess: (createdManager) => {
      console.log("Manager registered manager", createdManager.id);
      utils.users.list.setData(undefined, (current) => {
        if (!current) {
          return [createdManager];
        }
        return [createdManager, ...current];
      });
      utils.users.list.invalidate().catch((invalidateError) => {
        console.log("Users invalidate failed", invalidateError);
      });
      Alert.alert("הצלחה", "מנהל חדש נוצר עם הסיסמה שבחרת");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "יצירת המנהל נכשלה";
      console.log("Register manager failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: managerUpdateUserMutateAsync,
    status: managerUpdateUserMutationStatus,
  } = trpc.manager.updateUser.useMutation({
    onSuccess: (updatedUser) => {
      console.log("Manager updated user", updatedUser.id);
      utils.users.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedUser];
        }
        return current.map((usr) => (usr.id === updatedUser.id ? updatedUser : usr));
      });
      utils.users.list.invalidate().catch((invalidateError) => {
        console.log("Users invalidate failed", invalidateError);
      });
      Alert.alert("הצלחה", "פרטי המשתמש עודכנו בהצלחה");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "עדכון המשתמש נכשל";
      console.log("Manager update user failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: managerUpdateDeliveryMutateAsync,
    status: managerUpdateDeliveryStatus,
  } = trpc.manager.updateDelivery.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Manager updated delivery", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      Alert.alert("עודכן", "פרטי המשלוח עודכנו בהצלחה");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "עדכון המשלוח נכשל";
      console.log("Manager update delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: updateAvailabilityMutateAsync,
    status: updateAvailabilityStatus,
  } = trpc.courier.updateAvailability.useMutation({
    onSuccess: (updatedUser) => {
      console.log("Courier availability updated", updatedUser.id);
      utils.users.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedUser];
        }
        return current.map((usr) => (usr.id === updatedUser.id ? updatedUser : usr));
      });
      utils.users.list.invalidate().catch((invalidateError) => {
        console.log("Users invalidate failed", invalidateError);
      });
      applyUserState(updatedUser);
      void persistUserSafely(updatedUser);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "עדכון הזמינות נכשל";
      console.log("Update availability failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: confirmDeliveryMutateAsync,
    status: confirmDeliveryStatus,
  } = trpc.business.confirmDelivery.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Business confirmed delivery", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setBusinessCreationMessage("ההזמנה אושרה!\nההכנה החלה✅");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "לא ניתן לאשר את המשלוח";
      console.log("Confirm delivery failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const {
    mutateAsync: markReadyMutateAsync,
    status: markReadyStatus,
  } = trpc.business.markReady.useMutation({
    onSuccess: (updatedDelivery) => {
      console.log("Business marked delivery ready", updatedDelivery.id);
      utils.deliveries.list.setData(undefined, (current) => {
        if (!current) {
          return [updatedDelivery];
        }
        return current.map((delivery) => (delivery.id === updatedDelivery.id ? updatedDelivery : delivery));
      });
      utils.deliveries.list.invalidate().catch((invalidateError) => {
        console.log("Deliveries invalidate failed", invalidateError);
      });
      setBusinessCreationMessage("ההזמנה מוכנה!\nמחכה לאיסוף ע\"י השליח 🛵");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "לא ניתן לסמן את המשלוח כמוכן";
      console.log("Mark ready failed", error);
      Alert.alert("שגיאה", message);
    },
  });

  const deliveries = useMemo(() => {
    const raw = deliveriesData ?? [];
    const seenIds = new Set<string>();
    return raw.filter((delivery) => {
      if (!delivery.id || delivery.id.trim() === "") {
        console.log("Filtering out delivery with empty id");
        return false;
      }
      if (seenIds.has(delivery.id)) {
        console.log("Filtering out duplicate delivery id:", delivery.id);
        return false;
      }
      seenIds.add(delivery.id);
      return true;
    });
  }, [deliveriesData]);
  
  const allUsers = useMemo(() => {
    const raw = usersData ?? [];
    const seenIds = new Set<string>();
    return raw.filter((user) => {
      if (!user.id || user.id.trim() === "") {
        console.log("Filtering out user with empty id");
        return false;
      }
      if (seenIds.has(user.id)) {
        console.log("Filtering out duplicate user id:", user.id);
        return false;
      }
      seenIds.add(user.id);
      return true;
    });
  }, [usersData]);
  const isLoading = isUsersLoading || isDeliveriesLoading;

  const login = useCallback(
    async (payload: LoginPayload) => {
      console.log("Attempting login via backend", payload.phone);
      const result = await loginMutateAsync(payload);
      return result;
    },
    [loginMutateAsync],
  );

  const logout = useCallback(() => {
    console.log("Logging out current user");
    applyUserState(null);
    void persistUserSafely(null);
    setOriginalManagerUser(null);
    persistentStorage.removeItem(IMPERSONATION_KEY).catch((error) => {
      console.log("Failed to clear impersonation state", error);
    });
  }, [applyUserState, persistUserSafely]);

  const impersonateUser = useCallback((targetUser: User) => {
    if (!user || user.role !== "manager") {
      console.log("Only managers can impersonate users");
      return;
    }
    console.log("Manager impersonating user", targetUser.id, targetUser.role);
    setOriginalManagerUser(user);
    persistentStorage.setItem(IMPERSONATION_KEY, JSON.stringify(user)).catch((error) => {
      console.log("Failed to persist impersonation state", error);
    });
    applyUserState(targetUser);
    void persistUserSafely(targetUser);
  }, [user, applyUserState, persistUserSafely]);

  const exitImpersonation = useCallback(() => {
    if (!originalManagerUser) {
      console.log("No impersonation session to exit");
      return;
    }
    console.log("Exiting impersonation, returning to manager", originalManagerUser.id);
    applyUserState(originalManagerUser);
    void persistUserSafely(originalManagerUser);
    setOriginalManagerUser(null);
    persistentStorage.removeItem(IMPERSONATION_KEY).catch((error) => {
      console.log("Failed to clear impersonation state", error);
    });
  }, [originalManagerUser, applyUserState, persistUserSafely]);

  useEffect(() => {
    if (!hydrationCompletedRef.current) {
      return;
    }
    if (!user) {
      return;
    }
    if (allUsers.length === 0) {
      console.log("Users list empty, skipping sync to prevent logout");
      return;
    }
    const latest = allUsers.find((candidate) => candidate.id === user.id);
    if (!latest) {
      console.log("Active user missing from dataset, triggering logout", user.id, "Available users:", allUsers.length);
      logout();
      return;
    }
    const latestSignature = createStableSignature(latest);
    if (userSnapshotRef.current !== latestSignature) {
      console.log("Synchronizing active user with backend data", latest.id);
      applyUserState(latest);
      void persistUserSafely(latest);
    }
  }, [allUsers, applyUserState, logout, persistUserSafely, user]);

  const createDelivery = useCallback(
    async (payload: CreateDeliveryPayload) => {
      if (!user || user.role !== "business") {
        const error = new Error("רק עסקים יכולים ליצור משלוחים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Creating delivery request", payload.pickupAddress, payload.dropoffAddress, payload.customerName);
      const result = await createDeliveryMutateAsync({
        businessId: user.id,
        pickupAddress: payload.pickupAddress,
        dropoffAddress: payload.dropoffAddress,
        notes: payload.notes,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        preparationTimeMinutes: payload.preparationTimeMinutes,
      });
      return result;
    },
    [createDeliveryMutateAsync, user],
  );

  const takeDelivery = useCallback(
    async (deliveryId: string, estimatedArrivalMinutes: number) => {
      if (!user || user.role !== "courier") {
        const error = new Error("רק שליחים יכולים לקחת משלוחים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Courier taking delivery request", deliveryId, "ETA:", estimatedArrivalMinutes);
      const result = await takeDeliveryMutateAsync({
        courierId: user.id,
        deliveryId,
        estimatedArrivalMinutes,
      });
      return result;
    },
    [takeDeliveryMutateAsync, user],
  );

  const pickupDelivery = useCallback(
    async (deliveryId: string) => {
      if (!user || user.role !== "courier") {
        const error = new Error("רק שליחים יכולים לאסוף משלוחים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Courier picking up delivery request", deliveryId);
      const result = await pickupDeliveryMutateAsync({
        courierId: user.id,
        deliveryId,
      });
      return result;
    },
    [pickupDeliveryMutateAsync, user],
  );

  const completeDelivery = useCallback(
    async (deliveryId: string) => {
      if (!user || user.role !== "courier") {
        const error = new Error("רק שליחים יכולים לסמן משלוחים כהושלמו");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Courier completing delivery request", deliveryId);
      const result = await completeDeliveryMutateAsync({
        courierId: user.id,
        deliveryId,
      });
      return result;
    },
    [completeDeliveryMutateAsync, user],
  );

  const managerRegisterCourier = useCallback(
    async (payload: ManagerRegisterCourierPayload) => {
      if (!user || user.role !== "manager") {
        const error = new Error("גישה מותרת רק למנהלים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Manager registering courier request", payload.phone);
      const result = await managerRegisterCourierMutateAsync({
        ...payload,
        managerId: user.id,
      });
      return result;
    },
    [managerRegisterCourierMutateAsync, user],
  );

  const managerRegisterBusiness = useCallback(
    async (payload: ManagerRegisterBusinessPayload) => {
      if (!user || user.role !== "manager") {
        const error = new Error("גישה מותרת רק למנהלים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Manager registering business request", payload.phone);
      const result = await managerRegisterBusinessMutateAsync({
        ...payload,
        managerId: user.id,
      });
      return result;
    },
    [managerRegisterBusinessMutateAsync, user],
  );

  const managerRegisterManager = useCallback(
    async (payload: ManagerRegisterManagerPayload) => {
      if (!user || user.role !== "manager") {
        const error = new Error("גישה מותרת רק למנהלים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Manager registering manager request", payload.phone);
      const result = await managerRegisterManagerMutateAsync({
        ...payload,
        managerId: user.id,
      });
      return result;
    },
    [managerRegisterManagerMutateAsync, user],
  );

  const managerUpdateDelivery = useCallback(
    async (payload: ManagerUpdateDeliveryPayload) => {
      if (!user || user.role !== "manager") {
        const error = new Error("גישה מותרת רק למנהלים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Manager updating delivery request", payload.deliveryId, payload.status, payload.courierId);
      const result = await managerUpdateDeliveryMutateAsync({
        ...payload,
        managerId: user.id,
      });
      return result;
    },
    [managerUpdateDeliveryMutateAsync, user],
  );

  const managerUpdateUser = useCallback(
    async (payload: ManagerUpdateUserPayload) => {
      if (!user || user.role !== "manager") {
        const error = new Error("גישה מותרת רק למנהלים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Manager updating user request", payload.userId);
      const result = await managerUpdateUserMutateAsync({
        ...payload,
        managerId: user.id,
      });
      return result;
    },
    [managerUpdateUserMutateAsync, user],
  );

  const updateAvailability = useCallback(
    async (isAvailable: boolean) => {
      if (!user || user.role !== "courier") {
        const error = new Error("רק שליחים יכולים לעדכן זמינות");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Courier updating availability", isAvailable);
      const result = await updateAvailabilityMutateAsync({
        courierId: user.id,
        isAvailable,
      });
      return result;
    },
    [updateAvailabilityMutateAsync, user],
  );

  const confirmDelivery = useCallback(
    async (deliveryId: string) => {
      if (!user || user.role !== "business") {
        const error = new Error("רק עסקים יכולים לאשר משלוחים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Business confirming delivery request", deliveryId);
      const result = await confirmDeliveryMutateAsync({
        businessId: user.id,
        deliveryId,
      });
      return result;
    },
    [confirmDeliveryMutateAsync, user],
  );

  const markReady = useCallback(
    async (deliveryId: string) => {
      if (!user || user.role !== "business") {
        const error = new Error("רק עסקים יכולים לסמן משלוחים כמוכנים");
        Alert.alert("שגיאה", error.message);
        throw error;
      }
      console.log("Business marking delivery ready request", deliveryId);
      const result = await markReadyMutateAsync({
        businessId: user.id,
        deliveryId,
      });
      return result;
    },
    [markReadyMutateAsync, user],
  );

  const getDeliveriesForUser = useCallback(
    (role: UserRole, userId: string) => {
      if (role === "manager") {
        return deliveries;
      }
      if (role === "business") {
        return deliveries.filter((delivery) => delivery.businessId === userId);
      }
      return deliveries.filter((delivery) => delivery.courierId === userId);
    },
    [deliveries],
  );

  const dismissDelivery = useCallback((deliveryId: string) => {
    console.log("Dismissing delivery", deliveryId);
    setDismissedDeliveryIds((prev) => new Set([...prev, deliveryId]));
  }, []);

  const confirmBusinessNotification = useCallback((deliveryId: string) => {
    console.log("Confirming business notification", deliveryId);
    setConfirmedBusinessDeliveryIds((prev) => new Set([...prev, deliveryId]));
  }, []);

  const clearBusinessCreationMessage = useCallback(() => {
    setBusinessCreationMessage(null);
  }, []);

  const clearCourierAssignmentMessage = useCallback(() => {
    setCourierAssignmentMessage(null);
  }, []);

  const isImpersonating = originalManagerUser !== null;

  const getAvailableDeliveries = useCallback(() => {
    if (user?.role === "courier") {
      const isAvailable = user.courierProfile?.isAvailable ?? false;
      if (!isAvailable) {
        console.log("Courier is not available, returning empty deliveries list");
        return [];
      }
    }
    return deliveries.filter((delivery) => delivery.status === "waiting");
  }, [deliveries, user]);

  return useMemo<DeliveryContextValue>(() => ({
    user,
    deliveries,
    allUsers,
    isLoading,
    loginMutationStatus: loginStatus,
    createDeliveryMutationStatus: createDeliveryStatus,
    takeDeliveryMutationStatus: takeDeliveryStatus,
    pickupDeliveryMutationStatus: pickupDeliveryStatus,
    completeDeliveryMutationStatus: completeDeliveryStatus,
    confirmDeliveryMutationStatus: confirmDeliveryStatus,
    markReadyMutationStatus: markReadyStatus,
    managerUpdateDeliveryMutationStatus: managerUpdateDeliveryStatus,
    managerRegisterCourierMutationStatus,
    managerRegisterBusinessMutationStatus,
    managerRegisterManagerMutationStatus,
    managerUpdateUserMutationStatus,
    updateAvailabilityMutationStatus: updateAvailabilityStatus,
    login,
    logout,
    createDelivery,
    takeDelivery,
    pickupDelivery,
    completeDelivery,
    confirmDelivery,
    markReady,
    managerUpdateDelivery,
    managerRegisterCourier,
    managerRegisterBusiness,
    managerRegisterManager,
    managerUpdateUser,
    updateAvailability,
    getDeliveriesForUser,
    getAvailableDeliveries,
    dismissedDeliveryIds,
    dismissDelivery,
    confirmedBusinessDeliveryIds,
    confirmBusinessNotification,
    businessCreationMessage,
    clearBusinessCreationMessage,
    courierAssignmentMessage,
    clearCourierAssignmentMessage,
    isImpersonating,
    originalManagerUser,
    impersonateUser,
    exitImpersonation,
  }), [
    allUsers,
    completeDelivery,
    completeDeliveryStatus,
    confirmDelivery,
    confirmDeliveryStatus,
    markReady,
    markReadyStatus,
    createDelivery,
    createDeliveryStatus,
    deliveries,
    getAvailableDeliveries,
    getDeliveriesForUser,
    isLoading,
    login,
    loginStatus,
    logout,
    managerRegisterBusiness,
    managerRegisterBusinessMutationStatus,
    managerRegisterCourier,
    managerRegisterCourierMutationStatus,
    managerRegisterManager,
    managerRegisterManagerMutationStatus,
    managerUpdateUser,
    managerUpdateUserMutationStatus,
    managerUpdateDelivery,
    managerUpdateDeliveryStatus,
    takeDelivery,
    takeDeliveryStatus,
    pickupDelivery,
    pickupDeliveryStatus,
    updateAvailability,
    updateAvailabilityStatus,
    user,
    dismissedDeliveryIds,
    dismissDelivery,
    confirmedBusinessDeliveryIds,
    confirmBusinessNotification,
    businessCreationMessage,
    clearBusinessCreationMessage,
    courierAssignmentMessage,
    clearCourierAssignmentMessage,
    isImpersonating,
    originalManagerUser,
    impersonateUser,
    exitImpersonation,
  ]);
};

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const value = useDeliveryContextValue();
  
  useSupabaseRealtime();
  
  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery(): DeliveryContextValue {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error("useDelivery must be used within DeliveryProvider");
  }
  return context;
}
