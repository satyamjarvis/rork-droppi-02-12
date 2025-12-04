import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Edit3,
  Eye,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Store,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react-native";

import Colors from "../constants/colors";
import { useDelivery } from "../providers/DeliveryProvider";
import { Delivery, DeliveryStatus, User } from "../types/models";
import { UserEditModal } from "../components/UserEditModal";
import { CourierTrackingMap } from "../components/CourierTrackingMap";

type FinanceSnapshot = {
  totalCollected: number;
  pendingCollection: number;
  inProgressCollection: number;
};

type CourierFormState = {
  name: string;
  age: string;
  phone: string;
  email: string;
  vehicle: string;
  password: string;
  idNumber: string;
};

type BusinessFormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  password: string;
};

type ManagerFormState = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type DirectoryTab = "couriers" | "businesses" | "managers";

type DirectoryRow = {
  id: string;
  columns: string[];
};

type DirectoryConfig = {
  headers: string[];
  rows: DirectoryRow[];
  emptyMessage: string;
};

type BriefPeriod = "daily" | "weekly" | "monthly" | "custom";
type FinancePeriod = "daily" | "weekly" | "monthly" | "custom";
type CourierStatsPeriod = "daily" | "weekly" | "monthly" | "custom";
type BusinessStatsPeriod = "daily" | "weekly" | "monthly" | "custom";

type PeriodStats = {
  total: number;
  waiting: number;
  taken: number;
  completed: number;
  completionRate: number;
};

type CourierStats = {
  courier: User;
  total: number;
  completed: number;
  taken: number;
  completionRate: number;
  earnings: number;
};

type BusinessStats = {
  business: User;
  total: number;
  completed: number;
  waiting: number;
  completionRate: number;
  expenses: number;
};

const fallbackDisplayValue = (value: string | number | null | undefined): string => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}` : "לא סופק";
  }
  if (value === null || value === undefined) {
    return "לא סופק";
  }
  const trimmed = `${value}`.trim();
  return trimmed.length > 0 ? trimmed : "לא סופק";
};

const createEmptyCourierForm = (): CourierFormState => ({
  name: "",
  age: "",
  phone: "",
  email: "",
  vehicle: "",
  password: "",
  idNumber: "",
});

const createEmptyBusinessForm = (): BusinessFormState => ({
  name: "",
  address: "",
  phone: "",
  email: "",
  password: "",
});

const createEmptyManagerForm = (): ManagerFormState => ({
  name: "",
  phone: "",
  email: "",
  password: "",
});

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

type RegistrationType = "courier" | "business" | "manager";

type DashboardTab = "dashboard" | "map";

export default function ManagementDashboardScreen() {
  const {
    user,
    isLoading,
    deliveries,
    allUsers,
    logout,
    managerUpdateDelivery,
    managerUpdateDeliveryMutationStatus,
    managerRegisterCourier,
    managerRegisterCourierMutationStatus: courierRegisterStatus,
    managerRegisterBusiness,
    managerRegisterBusinessMutationStatus: businessRegisterStatus,
    managerRegisterManager,
    managerRegisterManagerMutationStatus: managerRegisterStatus,
    managerUpdateUser,
    managerUpdateUserMutationStatus,
    impersonateUser,
  } = useDelivery();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const completionProgress = useRef(new Animated.Value(0)).current;
  const [activeRegistrationType, setActiveRegistrationType] = useState<RegistrationType>("courier");
  const [courierForm, setCourierForm] = useState<CourierFormState>(() => createEmptyCourierForm());
  const [businessForm, setBusinessForm] = useState<BusinessFormState>(() => createEmptyBusinessForm());
  const [managerForm, setManagerForm] = useState<ManagerFormState>(() => createEmptyManagerForm());
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<DirectoryTab>("couriers");
  const [activeBriefPeriod, setActiveBriefPeriod] = useState<BriefPeriod>("daily");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [courierStatsPeriod, setCourierStatsPeriod] = useState<CourierStatsPeriod>("daily");
  const [courierStatsStartDate, setCourierStatsStartDate] = useState<string>("");
  const [courierStatsEndDate, setCourierStatsEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<"start" | "end">("start");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [businessStatsPeriod, setBusinessStatsPeriod] = useState<BusinessStatsPeriod>("daily");
  const [businessStatsStartDate, setBusinessStatsStartDate] = useState<string>("");
  const [businessStatsEndDate, setBusinessStatsEndDate] = useState<string>("");
  const [showBusinessDatePicker, setShowBusinessDatePicker] = useState(false);
  const [businessCalendarField, setBusinessCalendarField] = useState<"start" | "end">("start");
  const [showBusinessCalendarModal, setShowBusinessCalendarModal] = useState(false);
  const [businessCalendarMonth, setBusinessCalendarMonth] = useState(() => new Date());
  const [courierSearchQuery, setCourierSearchQuery] = useState("");
  const [businessSearchQuery, setBusinessSearchQuery] = useState("");
  const [briefStatsStartDate, setBriefStatsStartDate] = useState<string>("");
  const [briefStatsEndDate, setBriefStatsEndDate] = useState<string>("");
  const [showBriefDatePicker, setShowBriefDatePicker] = useState(false);
  const [showBriefCalendarModal, setShowBriefCalendarModal] = useState(false);
  const [briefCalendarMonth, setBriefCalendarMonth] = useState(() => new Date());
  const [briefCalendarField, setBriefCalendarField] = useState<"start" | "end">("start");
  const [financePeriod, setFinancePeriod] = useState<FinancePeriod>("daily");
  const [financeStartDate, setFinanceStartDate] = useState<string>("");
  const [financeEndDate, setFinanceEndDate] = useState<string>("");
  const [showFinanceDatePicker, setShowFinanceDatePicker] = useState(false);
  const [showFinanceCalendarModal, setShowFinanceCalendarModal] = useState(false);
  const [financeCalendarMonth, setFinanceCalendarMonth] = useState(() => new Date());
  const [financeCalendarField, setFinanceCalendarField] = useState<"start" | "end">("start");
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.role !== "manager") {
      Alert.alert("שגיאה", "גישה מותרת רק למנהלים");
      router.replace("/");
    }
  }, [router, user]);

  const isManagerActionLoading = managerUpdateDeliveryMutationStatus === "pending";
  const isCourierSubmitting = courierRegisterStatus === "pending";
  const isBusinessSubmitting = businessRegisterStatus === "pending";
  const isManagerSubmittingRequest = managerRegisterStatus === "pending";

  const isCourierFormReady = useMemo(() => {
    return (
      courierForm.name.trim().length > 0 &&
      courierForm.age.trim().length > 0 &&
      courierForm.phone.trim().length > 0 &&
      courierForm.email.trim().length > 0 &&
      courierForm.vehicle.trim().length > 0 &&
      courierForm.password.trim().length >= 4
    );
  }, [courierForm]);

  const isBusinessFormReady = useMemo(() => {
    return (
      businessForm.name.trim().length > 0 &&
      businessForm.address.trim().length > 0 &&
      businessForm.phone.trim().length > 0 &&
      businessForm.email.trim().length > 0 &&
      businessForm.password.trim().length >= 4
    );
  }, [businessForm]);

  const isManagerFormReady = useMemo(() => {
    return (
      managerForm.name.trim().length > 0 &&
      managerForm.phone.trim().length > 0 &&
      managerForm.email.trim().length > 0 &&
      managerForm.password.trim().length >= 4
    );
  }, [managerForm]);

  const courierSubmitDisabled = isCourierSubmitting || !isCourierFormReady;
  const businessSubmitDisabled = isBusinessSubmitting || !isBusinessFormReady;
  const managerSubmitDisabled = isManagerSubmittingRequest || !isManagerFormReady;
  const placeholderColor = "rgba(15, 23, 42, 0.35)";

  const getFilteredDeliveries = useCallback((period: BriefPeriod, startDate?: string, endDate?: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return deliveries.filter((delivery) => {
      const createdAt = new Date(delivery.createdAt);
      switch (period) {
        case "daily":
          return createdAt >= startOfDay;
        case "weekly":
          return createdAt >= startOfWeek;
        case "monthly":
          return createdAt >= startOfMonth;
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return createdAt >= start && createdAt <= end;
          }
          return true;
        default:
          return true;
      }
    });
  }, [deliveries]);

  const getCourierFilteredDeliveries = useCallback((period: CourierStatsPeriod, startDate?: string, endDate?: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return deliveries.filter((delivery) => {
      const createdAt = new Date(delivery.createdAt);
      switch (period) {
        case "daily":
          return createdAt >= startOfDay;
        case "weekly":
          return createdAt >= startOfWeek;
        case "monthly":
          return createdAt >= startOfMonth;
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return createdAt >= start && createdAt <= end;
          }
          return true;
        default:
          return true;
      }
    });
  }, [deliveries]);

  const calculateStats = useCallback((filteredDeliveries: Delivery[]): PeriodStats => {
    const total = filteredDeliveries.length;
    const waiting = filteredDeliveries.filter((d) => d.status === "waiting").length;
    const taken = filteredDeliveries.filter((d) => d.status === "taken").length;
    const completed = filteredDeliveries.filter((d) => d.status === "completed").length;
    const completionRate = total > 0 ? completed / total : 0;
    return { total, waiting, taken, completed, completionRate };
  }, []);

  const periodStats = useMemo<Record<Exclude<BriefPeriod, "custom">, PeriodStats>>(() => {
    return {
      daily: calculateStats(getFilteredDeliveries("daily")),
      weekly: calculateStats(getFilteredDeliveries("weekly")),
      monthly: calculateStats(getFilteredDeliveries("monthly")),
    };
  }, [calculateStats, getFilteredDeliveries]);

  const customBriefStats = useMemo<PeriodStats>(() => {
    return calculateStats(getFilteredDeliveries("custom", briefStatsStartDate, briefStatsEndDate));
  }, [calculateStats, getFilteredDeliveries, briefStatsStartDate, briefStatsEndDate]);

  const currentStats = activeBriefPeriod === "custom" ? customBriefStats : periodStats[activeBriefPeriod];

  useEffect(() => {
    Animated.timing(completionProgress, {
      toValue: currentStats.completionRate,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [completionProgress, currentStats.completionRate]);

  const couriers = useMemo(() => {
    const seen = new Set<string>();
    return allUsers.filter((candidate) => {
      if (candidate.role !== "courier" || !candidate.id || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }, [allUsers]);
  const businesses = useMemo(() => {
    const seen = new Set<string>();
    return allUsers.filter((candidate) => {
      if (candidate.role !== "business" || !candidate.id || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }, [allUsers]);
  const managers = useMemo(() => {
    const seen = new Set<string>();
    return allUsers.filter((candidate) => {
      if (candidate.role !== "manager" || !candidate.id || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }, [allUsers]);

  const courierStatsByPeriod = useMemo<CourierStats[]>(() => {
    const filteredDeliveries = getCourierFilteredDeliveries(courierStatsPeriod, courierStatsStartDate, courierStatsEndDate);
    const searchLower = courierSearchQuery.trim().toLowerCase();
    return couriers
      .filter((courier) => {
        if (!searchLower) return true;
        return courier.name.toLowerCase().includes(searchLower);
      })
      .map((courier) => {
        const courierDeliveries = filteredDeliveries.filter((d) => d.courierId === courier.id);
        const total = courierDeliveries.length;
        const completedDeliveries = courierDeliveries.filter((d) => d.status === "completed");
        const completed = completedDeliveries.length;
        const taken = courierDeliveries.filter((d) => d.status === "taken").length;
        const rate = total > 0 ? completed / total : 0;
        const earnings = completedDeliveries.reduce((sum, d) => sum + (d.payment ?? 0), 0);
        return { courier, total, completed, taken, completionRate: rate, earnings };
      })
      .filter((s) => s.total > 0 || courierSearchQuery.trim().length > 0)
      .sort((a, b) => b.completed - a.completed);
  }, [courierStatsPeriod, courierStatsStartDate, courierStatsEndDate, couriers, getCourierFilteredDeliveries, courierSearchQuery]);

  const getBusinessFilteredDeliveries = useCallback((period: BusinessStatsPeriod, startDate?: string, endDate?: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return deliveries.filter((delivery) => {
      const createdAt = new Date(delivery.createdAt);
      switch (period) {
        case "daily":
          return createdAt >= startOfDay;
        case "weekly":
          return createdAt >= startOfWeek;
        case "monthly":
          return createdAt >= startOfMonth;
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return createdAt >= start && createdAt <= end;
          }
          return true;
        default:
          return true;
      }
    });
  }, [deliveries]);

  const businessStatsByPeriod = useMemo<BusinessStats[]>(() => {
    const filteredDeliveries = getBusinessFilteredDeliveries(businessStatsPeriod, businessStatsStartDate, businessStatsEndDate);
    const searchLower = businessSearchQuery.trim().toLowerCase();
    return businesses
      .filter((business) => {
        if (!searchLower) return true;
        return business.name.toLowerCase().includes(searchLower);
      })
      .map((business) => {
        const businessDeliveries = filteredDeliveries.filter((d) => d.businessId === business.id);
        const total = businessDeliveries.length;
        const completedDeliveries = businessDeliveries.filter((d) => d.status === "completed");
        const completed = completedDeliveries.length;
        const waiting = businessDeliveries.filter((d) => d.status === "waiting").length;
        const rate = total > 0 ? completed / total : 0;
        const expenses = completedDeliveries.reduce((sum, d) => sum + (d.payment ?? 0), 0);
        return { business, total, completed, waiting, completionRate: rate, expenses };
      })
      .filter((s) => s.total > 0 || businessSearchQuery.trim().length > 0)
      .sort((a, b) => b.total - a.total);
  }, [businessStatsPeriod, businessStatsStartDate, businessStatsEndDate, businesses, getBusinessFilteredDeliveries, businessSearchQuery]);

  const directoryData = useMemo<Record<DirectoryTab, DirectoryConfig>>(() => {
    const courierRows = couriers.map((courier) => {
      const emailValue = fallbackDisplayValue(courier.courierProfile?.email ?? courier.email);
      const vehicleValue = fallbackDisplayValue(courier.courierProfile?.vehicle);
      const ageValue = courier.courierProfile?.age ? fallbackDisplayValue(courier.courierProfile.age) : "לא סופק";
      const idNumberValue = fallbackDisplayValue(courier.courierProfile?.idNumber);
      return {
        id: courier.id,
        columns: [
          fallbackDisplayValue(courier.name),
          fallbackDisplayValue(courier.password),
          fallbackDisplayValue(courier.phone),
          emailValue,
          ageValue,
          vehicleValue,
          idNumberValue,
        ],
      };
    });

    const businessRows = businesses.map((business) => {
      const emailValue = fallbackDisplayValue(business.businessProfile?.email ?? business.email);
      const addressValue = fallbackDisplayValue(business.businessProfile?.address);
      return {
        id: business.id,
        columns: [
          fallbackDisplayValue(business.name),
          fallbackDisplayValue(business.password),
          fallbackDisplayValue(business.phone),
          emailValue,
          addressValue,
        ],
      };
    });

    const managerRows = managers.map((managerUser) => {
      const emailValue = fallbackDisplayValue(managerUser.email);
      return {
        id: managerUser.id,
        columns: [
          fallbackDisplayValue(managerUser.name),
          fallbackDisplayValue(managerUser.password),
          fallbackDisplayValue(managerUser.phone),
          emailValue,
        ],
      };
    });

    return {
      couriers: {
        headers: ["שם מלא", "סיסמה", "טלפון", "אימייל", "גיל", "כלי תחבורה", "ת.ז."],
        rows: courierRows,
        emptyMessage: "אין שליחים רשומים כרגע.",
      },
      businesses: {
        headers: ["שם עסק", "סיסמה", "טלפון", "אימייל", "כתובת"],
        rows: businessRows,
        emptyMessage: "אין עסקים רשומים כרגע.",
      },
      managers: {
        headers: ["שם מלא", "סיסמה", "טלפון", "אימייל"],
        rows: managerRows,
        emptyMessage: "אין מנהלים נוספים רשומים כרגע.",
      },
    };
  }, [businesses, couriers, managers]);

  const activeDirectory = directoryData[activeDirectoryTab];

  const waitingDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "waiting"),
    [deliveries],
  );

  const activeDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "taken"),
    [deliveries],
  );

  const getFinanceFilteredDeliveries = useCallback((period: FinancePeriod, startDate?: string, endDate?: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return deliveries.filter((delivery) => {
      const createdAt = new Date(delivery.createdAt);
      switch (period) {
        case "daily":
          return createdAt >= startOfDay;
        case "weekly":
          return createdAt >= startOfWeek;
        case "monthly":
          return createdAt >= startOfMonth;
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return createdAt >= start && createdAt <= end;
          }
          return true;
        default:
          return true;
      }
    });
  }, [deliveries]);

  const financeSnapshot = useMemo<FinanceSnapshot>(() => {
    const filteredDeliveries = getFinanceFilteredDeliveries(financePeriod, financeStartDate, financeEndDate);
    const completedDeliveries = filteredDeliveries.filter((d) => d.status === "completed");
    const waitingDeliveries = filteredDeliveries.filter((d) => d.status === "waiting");
    const takenDeliveries = filteredDeliveries.filter((d) => d.status === "taken");
    
    const totalCollected = completedDeliveries.reduce((sum, d) => sum + (d.payment ?? 0), 0);
    const pendingCollection = waitingDeliveries.reduce((sum, d) => sum + (d.payment ?? 0), 0);
    const inProgressCollection = takenDeliveries.reduce((sum, d) => sum + (d.payment ?? 0), 0);
    
    return { totalCollected, pendingCollection, inProgressCollection };
  }, [getFinanceFilteredDeliveries, financePeriod, financeStartDate, financeEndDate]);

  const completionWidth = completionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const toggleDeliveryExpansion = useCallback((deliveryId: string) => {
    setExpandedDeliveryId((current) => (current === deliveryId ? null : deliveryId));
  }, []);

  const handleDirectoryTabChange = useCallback(
    (nextTab: DirectoryTab) => {
      if (nextTab === activeDirectoryTab) {
        return;
      }
      console.log("Switching directory tab", nextTab);
      setActiveDirectoryTab(nextTab);
    },
    [activeDirectoryTab],
  );

  const handleManagerAction = useCallback(
    async (deliveryId: string, nextStatus: DeliveryStatus, courierId?: string | null) => {
      console.log("Manager action", deliveryId, nextStatus, courierId);
      try {
        await managerUpdateDelivery({ deliveryId, status: nextStatus, courierId });
        setExpandedDeliveryId(null);
      } catch (error) {
        console.log("Manager action failed", error);
      }
    },
    [managerUpdateDelivery],
  );

  const handleRegistrationToggle = useCallback(
    (nextType: RegistrationType) => {
      if (nextType === activeRegistrationType) {
        return;
      }
      console.log("Switching registration type", nextType);
      setActiveRegistrationType(nextType);
    },
    [activeRegistrationType],
  );

  const handleCourierFieldChange = useCallback(
    (field: keyof CourierFormState) => (value: string) => {
      setCourierForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleBusinessFieldChange = useCallback(
    (field: keyof BusinessFormState) => (value: string) => {
      setBusinessForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleManagerFieldChange = useCallback(
    (field: keyof ManagerFormState) => (value: string) => {
      setManagerForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleCourierRegistration = useCallback(async () => {
    console.log("Submitting courier registration", courierForm);
    const trimmedName = courierForm.name.trim();
    const trimmedAge = courierForm.age.trim();
    const trimmedPhone = courierForm.phone.trim();
    const trimmedEmail = courierForm.email.trim();
    const trimmedVehicle = courierForm.vehicle.trim();
    const trimmedPassword = courierForm.password.trim();
    if (!trimmedName || !trimmedAge || !trimmedPhone || !trimmedEmail || !trimmedVehicle || !trimmedPassword) {
      Alert.alert("שגיאה", "נא למלא את כל פרטי השליח");
      return;
    }
    const parsedAge = Number.parseInt(trimmedAge, 10);
    if (Number.isNaN(parsedAge)) {
      Alert.alert("שגיאה", "גיל השליח חייב להיות מספר תקין");
      return;
    }
    if (trimmedPassword.length < 4) {
      Alert.alert("שגיאה", "הסיסמה צריכה להיות לפחות באורך 4 תווים");
      return;
    }
    try {
      const trimmedIdNumber = courierForm.idNumber.trim();
      await managerRegisterCourier({
        name: trimmedName,
        age: parsedAge,
        phone: trimmedPhone,
        email: trimmedEmail,
        vehicle: trimmedVehicle,
        password: trimmedPassword,
        idNumber: trimmedIdNumber || undefined,
      });
      console.log("Courier registration completed");
      setCourierForm(createEmptyCourierForm());
    } catch (error) {
      console.log("Courier registration failed", error);
    }
  }, [courierForm, managerRegisterCourier]);

  const handleBusinessRegistration = useCallback(async () => {
    console.log("Submitting business registration", businessForm);
    const trimmedName = businessForm.name.trim();
    const trimmedAddress = businessForm.address.trim();
    const trimmedPhone = businessForm.phone.trim();
    const trimmedEmail = businessForm.email.trim();
    const trimmedPassword = businessForm.password.trim();
    if (!trimmedName || !trimmedAddress || !trimmedPhone || !trimmedEmail || !trimmedPassword) {
      Alert.alert("שגיאה", "נא למלא את כל פרטי העסק");
      return;
    }
    if (trimmedPassword.length < 4) {
      Alert.alert("שגיאה", "הסיסמה צריכה להיות לפחות באורך 4 תווים");
      return;
    }
    try {
      await managerRegisterBusiness({
        name: trimmedName,
        address: trimmedAddress,
        phone: trimmedPhone,
        email: trimmedEmail,
        password: trimmedPassword,
      });
      console.log("Business registration completed");
      setBusinessForm(createEmptyBusinessForm());
    } catch (error) {
      console.log("Business registration failed", error);
    }
  }, [businessForm, managerRegisterBusiness]);

  const handleManagerRegistration = useCallback(async () => {
    console.log("Submitting manager registration", managerForm);
    const trimmedName = managerForm.name.trim();
    const trimmedPhone = managerForm.phone.trim();
    const trimmedEmail = managerForm.email.trim();
    const trimmedPassword = managerForm.password.trim();
    if (!trimmedName || !trimmedPhone || !trimmedEmail || !trimmedPassword) {
      Alert.alert("שגיאה", "נא למלא את כל פרטי המנהל");
      return;
    }
    if (trimmedPassword.length < 4) {
      Alert.alert("שגיאה", "הסיסמה צריכה להיות לפחות באורך 4 תווים");
      return;
    }
    try {
      await managerRegisterManager({
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        password: trimmedPassword,
      });
      console.log("Manager registration completed");
      setManagerForm(createEmptyManagerForm());
    } catch (error) {
      console.log("Manager registration failed", error);
    }
  }, [managerForm, managerRegisterManager]);

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/");
  }, [logout, router]);

  const handleEditUser = useCallback((userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser) {
      console.log("Opening edit modal for user", userId);
      setEditingUser(targetUser);
      setIsEditModalVisible(true);
    }
  }, [allUsers]);

  const handleImpersonateUser = useCallback((userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser && (targetUser.role === "courier" || targetUser.role === "business")) {
      console.log("Impersonating user", userId, targetUser.role);
      impersonateUser(targetUser);
      router.replace("/(tabs)/my-deliveries");
    }
  }, [allUsers, impersonateUser, router]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingUser(null);
  }, []);

  const handleSaveUserEdit = useCallback(async (payload: {
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
  }) => {
    console.log("Saving user edit", payload);
    try {
      await managerUpdateUser(payload);
      handleCloseEditModal();
    } catch (error) {
      console.log("Save user edit failed", error);
    }
  }, [managerUpdateUser, handleCloseEditModal]);

  const openDatePicker = useCallback((field: "start" | "end") => {
    setActiveDateField(field);
    const currentValue = field === "start" ? courierStatsStartDate : courierStatsEndDate;
    if (currentValue) {
      setCalendarMonth(new Date(currentValue));
    } else {
      setCalendarMonth(new Date());
    }
    setShowCalendarModal(true);
  }, [courierStatsStartDate, courierStatsEndDate]);

  const handleSelectDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    if (activeDateField === "start") {
      setCourierStatsStartDate(formattedDate);
    } else {
      setCourierStatsEndDate(formattedDate);
    }
    setShowCalendarModal(false);
  }, [activeDateField]);

  const openBusinessDatePicker = useCallback((field: "start" | "end") => {
    setBusinessCalendarField(field);
    const currentValue = field === "start" ? businessStatsStartDate : businessStatsEndDate;
    if (currentValue) {
      setBusinessCalendarMonth(new Date(currentValue));
    } else {
      setBusinessCalendarMonth(new Date());
    }
    setShowBusinessCalendarModal(true);
  }, [businessStatsStartDate, businessStatsEndDate]);

  const handleSelectBusinessDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    if (businessCalendarField === "start") {
      setBusinessStatsStartDate(formattedDate);
    } else {
      setBusinessStatsEndDate(formattedDate);
    }
    setShowBusinessCalendarModal(false);
  }, [businessCalendarField]);

  const getBusinessCalendarDays = useCallback(() => {
    const year = businessCalendarMonth.getFullYear();
    const month = businessCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [businessCalendarMonth]);

  const goToPrevBusinessMonth = useCallback(() => {
    setBusinessCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextBusinessMonth = useCallback(() => {
    setBusinessCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const getCalendarDays = useCallback(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [calendarMonth]);

  const formatMonthYear = useCallback((date: Date) => {
    const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }, []);

  const goToPrevMonth = useCallback(() => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const openBriefDatePicker = useCallback((field: "start" | "end") => {
    setBriefCalendarField(field);
    const currentValue = field === "start" ? briefStatsStartDate : briefStatsEndDate;
    if (currentValue) {
      setBriefCalendarMonth(new Date(currentValue));
    } else {
      setBriefCalendarMonth(new Date());
    }
    setShowBriefCalendarModal(true);
  }, [briefStatsStartDate, briefStatsEndDate]);

  const handleSelectBriefDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    if (briefCalendarField === "start") {
      setBriefStatsStartDate(formattedDate);
    } else {
      setBriefStatsEndDate(formattedDate);
    }
    setShowBriefCalendarModal(false);
  }, [briefCalendarField]);

  const getBriefCalendarDays = useCallback(() => {
    const year = briefCalendarMonth.getFullYear();
    const month = briefCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [briefCalendarMonth]);

  const goToPrevBriefMonth = useCallback(() => {
    setBriefCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextBriefMonth = useCallback(() => {
    setBriefCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const openFinanceDatePicker = useCallback((field: "start" | "end") => {
    setFinanceCalendarField(field);
    const currentValue = field === "start" ? financeStartDate : financeEndDate;
    if (currentValue) {
      setFinanceCalendarMonth(new Date(currentValue));
    } else {
      setFinanceCalendarMonth(new Date());
    }
    setShowFinanceCalendarModal(true);
  }, [financeStartDate, financeEndDate]);

  const handleSelectFinanceDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    if (financeCalendarField === "start") {
      setFinanceStartDate(formattedDate);
    } else {
      setFinanceEndDate(formattedDate);
    }
    setShowFinanceCalendarModal(false);
  }, [financeCalendarField]);

  const getFinanceCalendarDays = useCallback(() => {
    const year = financeCalendarMonth.getFullYear();
    const month = financeCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [financeCalendarMonth]);

  const goToPrevFinanceMonth = useCallback(() => {
    setFinanceCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextFinanceMonth = useCallback(() => {
    setFinanceCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const managerName = user?.name ?? "הנהלה";

  if (!user || user.role !== "manager") {
    return null;
  }

  return (
    <View style={styles.screen}>
      {activeTab === "dashboard" && (
        <LinearGradient
          colors={[Colors.light.tint, Colors.light.tintDark]}
          style={styles.heroGradient}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
      
      {activeTab === "dashboard" && (
        <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}
          testID="manager-header-container"
        >
          <View style={styles.header} testID="manager-header">
            <Pressable onPress={handleLogout} style={styles.headerActionButton} testID="manager-logout-button">
              <LogOut color={Colors.light.surface} size={18} />
              <Text style={styles.headerActionText}>התנתק</Text>
            </Pressable>
            <View style={styles.headerTitles}>
              <Text style={styles.managerLabel}>לוח הנהלה</Text>
              <Text style={styles.managerName}>{managerName}</Text>
              <Text style={styles.managerSubLabel}>מנהלים רשומים: {managers.length}</Text>
            </View>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer} testID="management-loading">
          <ActivityIndicator size="large" color={Colors.light.surface} />
        </View>
      ) : null}

      {activeTab === "map" ? (
        <View style={[styles.fullScreenMapWrapper, { paddingTop: insets.top }]}>
          <CourierTrackingMap couriers={couriers} fullScreen />
        </View>
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        testID="management-scroll"
      >
        <View style={styles.section} testID="management-registration">
          <View style={styles.sectionHeader}>
            <UserPlus color={Colors.light.tint} size={20} />
            <Text style={styles.sectionTitle}>רישום משתמשים</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            הוספה מהירה של שליחים, עסקים ומנהלים דרך צוות ההנהלה
          </Text>
          <View style={styles.registrationToggle}>
            <Pressable
              onPress={() => handleRegistrationToggle("courier")}
              style={[
                styles.toggleButton,
                activeRegistrationType === "courier" ? styles.toggleButtonActive : styles.toggleButtonInactive,
              ]}
              testID="toggle-courier-registration"
            >
              <UserPlus
                color={activeRegistrationType === "courier" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.toggleText,
                  activeRegistrationType === "courier" ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                שליח חדש
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleRegistrationToggle("business")}
              style={[
                styles.toggleButton,
                activeRegistrationType === "business" ? styles.toggleButtonActive : styles.toggleButtonInactive,
              ]}
              testID="toggle-business-registration"
            >
              <Briefcase
                color={activeRegistrationType === "business" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.toggleText,
                  activeRegistrationType === "business" ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                עסק חדש
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleRegistrationToggle("manager")}
              style={[
                styles.toggleButton,
                activeRegistrationType === "manager" ? styles.toggleButtonActive : styles.toggleButtonInactive,
              ]}
              testID="toggle-manager-registration"
            >
              <ShieldCheck
                color={activeRegistrationType === "manager" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.toggleText,
                  activeRegistrationType === "manager" ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                מנהל חדש
              </Text>
            </Pressable>
          </View>
          {activeRegistrationType === "courier" ? (
            <View style={styles.formContainer} testID="courier-registration-form">
              <View style={styles.inputsColumn}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>שם השליח</Text>
                  <TextInput
                    value={courierForm.name}
                    onChangeText={handleCourierFieldChange("name")}
                    style={styles.input}
                    placeholder="הקלד שם מלא"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="words"
                    testID="courier-name-input"
                  />
                </View>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={styles.inputLabel}>גיל</Text>
                    <TextInput
                      value={courierForm.age}
                      onChangeText={handleCourierFieldChange("age")}
                      style={styles.input}
                      placeholder="18+"
                      placeholderTextColor={placeholderColor}
                      keyboardType="number-pad"
                      maxLength={2}
                      testID="courier-age-input"
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={styles.inputLabel}>כלי תחבורה</Text>
                    <TextInput
                      value={courierForm.vehicle}
                      onChangeText={handleCourierFieldChange("vehicle")}
                      style={styles.input}
                      placeholder="לדוגמה: אופנוע"
                      placeholderTextColor={placeholderColor}
                      testID="courier-vehicle-input"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>מספר טלפון</Text>
                  <TextInput
                    value={courierForm.phone}
                    onChangeText={handleCourierFieldChange("phone")}
                    style={styles.input}
                    placeholder="05X-XXXXXXX"
                    placeholderTextColor={placeholderColor}
                    keyboardType="phone-pad"
                    testID="courier-phone-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>כתובת אימייל</Text>
                  <TextInput
                    value={courierForm.email}
                    onChangeText={handleCourierFieldChange("email")}
                    style={styles.input}
                    placeholder="example@droppi.co.il"
                    placeholderTextColor={placeholderColor}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="courier-email-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>סיסמה לחשבון</Text>
                  <TextInput
                    value={courierForm.password}
                    onChangeText={handleCourierFieldChange("password")}
                    style={styles.input}
                    placeholder="לפחות 4 תווים"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                    testID="courier-password-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>תעודת זהות (אופציונלי)</Text>
                  <TextInput
                    value={courierForm.idNumber}
                    onChangeText={handleCourierFieldChange("idNumber")}
                    style={styles.input}
                    placeholder="מספר תעודת זהות"
                    placeholderTextColor={placeholderColor}
                    keyboardType="number-pad"
                    testID="courier-id-number-input"
                  />
                </View>
              </View>
              <Pressable
                onPress={handleCourierRegistration}
                disabled={courierSubmitDisabled}
                style={[styles.submitButton, courierSubmitDisabled && styles.disabledButton]}
                testID="submit-courier"
              >
                <View style={styles.buttonContent}>
                  {isCourierSubmitting ? (
                    <ActivityIndicator color={Colors.light.surface} style={styles.buttonLoader} />
                  ) : (
                    <UserPlus color={Colors.light.surface} size={18} />
                  )}
                  <Text style={styles.submitButtonText}>שמור שליח</Text>
                </View>
              </Pressable>
              {isCourierSubmitting ? (
                <Text style={styles.statusText} testID="courier-submitting-status">
                  שומר את השליח החדש...
                </Text>
              ) : null}
              <Text style={styles.helperText}>בחרו סיסמה ייחודית ושלחו אותה לשליח בצורה מאובטחת.</Text>
            </View>
          ) : null}
          {activeRegistrationType === "business" ? (
            <View style={styles.formContainer} testID="business-registration-form">
              <View style={styles.inputsColumn}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>שם העסק</Text>
                  <TextInput
                    value={businessForm.name}
                    onChangeText={handleBusinessFieldChange("name")}
                    style={styles.input}
                    placeholder="למשל: מאפה היובל"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="words"
                    testID="business-name-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>כתובת העסק</Text>
                  <TextInput
                    value={businessForm.address}
                    onChangeText={handleBusinessFieldChange("address")}
                    style={styles.input}
                    placeholder="רחוב, מספר ועיר"
                    placeholderTextColor={placeholderColor}
                    testID="business-address-input"
                  />
                </View>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={styles.inputLabel}>טלפון</Text>
                    <TextInput
                      value={businessForm.phone}
                      onChangeText={handleBusinessFieldChange("phone")}
                      style={styles.input}
                      placeholder="טלפון ליצירת קשר"
                      placeholderTextColor={placeholderColor}
                      keyboardType="phone-pad"
                      testID="business-phone-input"
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputHalf]}>
                    <Text style={styles.inputLabel}>אימייל</Text>
                    <TextInput
                      value={businessForm.email}
                      onChangeText={handleBusinessFieldChange("email")}
                      style={styles.input}
                      placeholder="office@business.co.il"
                      placeholderTextColor={placeholderColor}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      testID="business-email-input"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>סיסמה לחשבון</Text>
                  <TextInput
                    value={businessForm.password}
                    onChangeText={handleBusinessFieldChange("password")}
                    style={styles.input}
                    placeholder="לפחות 4 תווים"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                    testID="business-password-input"
                  />
                </View>
              </View>
              <Pressable
                onPress={handleBusinessRegistration}
                disabled={businessSubmitDisabled}
                style={[styles.submitButton, businessSubmitDisabled && styles.disabledButton]}
                testID="submit-business"
              >
                <View style={styles.buttonContent}>
                  {isBusinessSubmitting ? (
                    <ActivityIndicator color={Colors.light.surface} style={styles.buttonLoader} />
                  ) : (
                    <Briefcase color={Colors.light.surface} size={18} />
                  )}
                  <Text style={styles.submitButtonText}>שמור עסק</Text>
                </View>
              </Pressable>
              {isBusinessSubmitting ? (
                <Text style={styles.statusText} testID="business-submitting-status">
                  שומר את פרטי העסק...
                </Text>
              ) : null}
              <Text style={styles.helperText}>בחרו סיסמה חזקה והעבירו אותה לנציג העסק באופן מאובטח.</Text>
            </View>
          ) : null}
          {activeRegistrationType === "manager" ? (
            <View style={styles.formContainer} testID="manager-registration-form">
              <View style={styles.inputsColumn}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>שם המנהל</Text>
                  <TextInput
                    value={managerForm.name}
                    onChangeText={handleManagerFieldChange("name")}
                    style={styles.input}
                    placeholder="שם מלא"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="words"
                    testID="manager-name-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>מספר טלפון</Text>
                  <TextInput
                    value={managerForm.phone}
                    onChangeText={handleManagerFieldChange("phone")}
                    style={styles.input}
                    placeholder="05X-XXXXXXX"
                    placeholderTextColor={placeholderColor}
                    keyboardType="phone-pad"
                    testID="manager-phone-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>אימייל</Text>
                  <TextInput
                    value={managerForm.email}
                    onChangeText={handleManagerFieldChange("email")}
                    style={styles.input}
                    placeholder="manager@droppi.co.il"
                    placeholderTextColor={placeholderColor}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="manager-email-input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>סיסמה לחשבון</Text>
                  <TextInput
                    value={managerForm.password}
                    onChangeText={handleManagerFieldChange("password")}
                    style={styles.input}
                    placeholder="לפחות 4 תווים"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                    testID="manager-password-input"
                  />
                </View>
              </View>
              <Pressable
                onPress={handleManagerRegistration}
                disabled={managerSubmitDisabled}
                style={[styles.submitButton, managerSubmitDisabled && styles.disabledButton]}
                testID="submit-manager"
              >
                <View style={styles.buttonContent}>
                  {isManagerSubmittingRequest ? (
                    <ActivityIndicator color={Colors.light.surface} style={styles.buttonLoader} />
                  ) : (
                    <ShieldCheck color={Colors.light.surface} size={18} />
                  )}
                  <Text style={styles.submitButtonText}>שמור מנהל</Text>
                </View>
              </Pressable>
              {isManagerSubmittingRequest ? (
                <Text style={styles.statusText} testID="manager-submitting-status">
                  שומר את פרטי המנהל...
                </Text>
              ) : null}
              <Text style={styles.helperText}>קבעו סיסמה מותאמת אישית עבור המנהל החדש ושימרו אותה במקום בטוח.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section} testID="management-directory">
          <View style={styles.sectionHeader}>
            <Users color={Colors.light.tint} size={20} />
            <Text style={styles.sectionTitle}>מאגר משתמשים</Text>
          </View>
          <Text style={styles.sectionSubtitle}>מידע ברור ומסודר על כל בעלי התפקידים</Text>
          <View style={styles.directoryToggle}>
            <Pressable
              onPress={() => handleDirectoryTabChange("couriers")}
              style={[
                styles.directoryToggleButton,
                activeDirectoryTab === "couriers" ? styles.directoryToggleButtonActive : styles.directoryToggleButtonInactive,
              ]}
              testID="directory-tab-couriers"
            >
              <Text
                style={[
                  styles.directoryToggleText,
                  activeDirectoryTab === "couriers"
                    ? styles.directoryToggleTextActive
                    : styles.directoryToggleTextInactive,
                ]}
              >
                שליחים
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDirectoryTabChange("businesses")}
              style={[
                styles.directoryToggleButton,
                activeDirectoryTab === "businesses"
                  ? styles.directoryToggleButtonActive
                  : styles.directoryToggleButtonInactive,
              ]}
              testID="directory-tab-businesses"
            >
              <Text
                style={[
                  styles.directoryToggleText,
                  activeDirectoryTab === "businesses"
                    ? styles.directoryToggleTextActive
                    : styles.directoryToggleTextInactive,
                ]}
              >
                עסקים
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDirectoryTabChange("managers")}
              style={[
                styles.directoryToggleButton,
                activeDirectoryTab === "managers"
                  ? styles.directoryToggleButtonActive
                  : styles.directoryToggleButtonInactive,
              ]}
              testID="directory-tab-managers"
            >
              <Text
                style={[
                  styles.directoryToggleText,
                  activeDirectoryTab === "managers"
                    ? styles.directoryToggleTextActive
                    : styles.directoryToggleTextInactive,
                ]}
              >
                מנהלים
              </Text>
            </Pressable>
          </View>
          <View style={styles.directoryTable} testID="directory-table">
            {activeDirectory.rows.length === 0 ? (
              <Text style={styles.directoryEmptyText} testID="directory-empty">
                {activeDirectory.emptyMessage}
              </Text>
            ) : (
              <View style={styles.directoryRowsContainer}>
                {activeDirectory.rows.map((row) => {
                  const rowDetails = activeDirectory.headers.map((header, columnIndex) => ({
                    header,
                    value: row.columns[columnIndex] ?? "לא סופק",
                  }));
                  return (
                    <View key={row.id} style={styles.directoryRowCard} testID={`directory-row-${row.id}`}>
                      <View style={styles.directoryRowHeader}>
                        {(activeDirectoryTab === "couriers" || activeDirectoryTab === "businesses") ? (
                          <Pressable
                            onPress={() => handleImpersonateUser(row.id)}
                            style={styles.impersonateButton}
                            testID={`impersonate-user-${row.id}`}
                          >
                            <Eye color={Colors.light.surface} size={16} />
                            <Text style={styles.impersonateButtonText}>צפה כמשתמש</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => handleEditUser(row.id)}
                          style={styles.editUserButton}
                          testID={`edit-user-${row.id}`}
                        >
                          <Edit3 color={Colors.light.tint} size={16} />
                          <Text style={styles.editUserButtonText}>עריכה</Text>
                        </Pressable>
                      </View>
                      {rowDetails.map((detail, index) => (
                        <View key={`${row.id}-${index}`} style={styles.directoryDetailRow}>
                          <Text style={styles.directoryDetailLabel}>{detail.header}</Text>
                          <Text style={styles.directoryDetailValue}>{detail.value}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        

        <View style={styles.section} testID="management-stats">
          <View style={styles.sectionHeader}>
            <Shield color={Colors.light.tint} size={20} />
            <Text style={styles.sectionTitle}>סיכום פעילות</Text>
          </View>
          <View style={styles.periodToggle}>
            <Pressable
              onPress={() => { setActiveBriefPeriod("daily"); setShowBriefDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                activeBriefPeriod === "daily" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="brief-period-daily"
            >
              <Calendar
                color={activeBriefPeriod === "daily" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  activeBriefPeriod === "daily" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                יומי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveBriefPeriod("weekly"); setShowBriefDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                activeBriefPeriod === "weekly" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="brief-period-weekly"
            >
              <CalendarDays
                color={activeBriefPeriod === "weekly" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  activeBriefPeriod === "weekly" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                שבועי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveBriefPeriod("monthly"); setShowBriefDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                activeBriefPeriod === "monthly" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="brief-period-monthly"
            >
              <CalendarDays
                color={activeBriefPeriod === "monthly" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  activeBriefPeriod === "monthly" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                חודשי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveBriefPeriod("custom"); setShowBriefDatePicker(true); }}
              style={[
                styles.periodToggleButton,
                activeBriefPeriod === "custom" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="brief-period-custom"
            >
              <CalendarDays
                color={activeBriefPeriod === "custom" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  activeBriefPeriod === "custom" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                תאריכים
              </Text>
            </Pressable>
          </View>

          {showBriefDatePicker && activeBriefPeriod === "custom" && (
            <View style={styles.datePickerContainer}>
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>מתאריך</Text>
                  <Pressable
                    style={styles.dateInputButton}
                    onPress={() => openBriefDatePicker("start")}
                    testID="brief-stats-start-date"
                  >
                    <Calendar color={Colors.light.tint} size={16} />
                    <Text style={[styles.dateInputButtonText, !briefStatsStartDate && styles.dateInputPlaceholder]}>
                      {briefStatsStartDate || "בחר תאריך"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>עד תאריך</Text>
                  <Pressable
                    style={styles.dateInputButton}
                    onPress={() => openBriefDatePicker("end")}
                    testID="brief-stats-end-date"
                  >
                    <Calendar color={Colors.light.tint} size={16} />
                    <Text style={[styles.dateInputButtonText, !briefStatsEndDate && styles.dateInputPlaceholder]}>
                      {briefStatsEndDate || "בחר תאריך"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {(briefStatsStartDate || briefStatsEndDate) ? (
                <Pressable
                  onPress={() => { setBriefStatsStartDate(""); setBriefStatsEndDate(""); }}
                  style={styles.clearDatesButton}
                >
                  <X color={Colors.light.secondaryText} size={14} />
                  <Text style={styles.clearDatesText}>נקה תאריכים</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {activeBriefPeriod === "daily" ? "משלוחים היום" : activeBriefPeriod === "weekly" ? "משלוחים השבוע" : activeBriefPeriod === "monthly" ? "משלוחים החודש" : "משלוחים בתקופה"}
              </Text>
              <Text style={styles.statValue}>{currentStats.total}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ממתינים</Text>
              <Text style={[styles.statValue, styles.waitingText]}>{currentStats.waiting}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>נמצאים בדרך</Text>
              <Text style={[styles.statValue, styles.takenText]}>{currentStats.taken}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>הושלמו</Text>
              <Text style={[styles.statValue, styles.completedText]}>{currentStats.completed}</Text>
            </View>
          </View>
          <View style={styles.completionRow}>
            <View style={styles.completionHeader}>
              <CheckCircle color={Colors.light.completed} size={18} />
              <Text style={styles.completionLabel}>שיעור השלמות</Text>
              <Text style={styles.completionValue}>{Math.round(currentStats.completionRate * 100)}%</Text>
            </View>
            <View style={styles.completionBarBackground}>
              <Animated.View style={[styles.completionBarFill, { width: completionWidth }]} />
            </View>
          </View>

          <View style={styles.statsBreakdownSection}>
              <View style={styles.breakdownHeader}>
                <Users color={Colors.light.tint} size={18} />
                <Text style={styles.breakdownTitle}>נתונים לפי שליח</Text>
              </View>
              <View style={styles.searchInputContainer}>
                <Search color={Colors.light.secondaryText} size={18} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="חפש שליח לפי שם..."
                  placeholderTextColor="rgba(15, 23, 42, 0.35)"
                  value={courierSearchQuery}
                  onChangeText={setCourierSearchQuery}
                  testID="courier-search-input"
                />
                {courierSearchQuery.length > 0 && (
                  <Pressable onPress={() => setCourierSearchQuery("")} style={styles.clearSearchButton}>
                    <X color={Colors.light.secondaryText} size={16} />
                  </Pressable>
                )}
              </View>
              <View style={styles.courierPeriodToggle}>
                <Pressable
                  onPress={() => { setCourierStatsPeriod("daily"); setShowDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    courierStatsPeriod === "daily" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="courier-stats-daily"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      courierStatsPeriod === "daily" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    יומי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setCourierStatsPeriod("weekly"); setShowDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    courierStatsPeriod === "weekly" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="courier-stats-weekly"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      courierStatsPeriod === "weekly" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    שבועי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setCourierStatsPeriod("monthly"); setShowDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    courierStatsPeriod === "monthly" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="courier-stats-monthly"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      courierStatsPeriod === "monthly" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    חודשי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setCourierStatsPeriod("custom"); setShowDatePicker(true); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    courierStatsPeriod === "custom" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="courier-stats-custom"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      courierStatsPeriod === "custom" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    תאריכים
                  </Text>
                </Pressable>
              </View>

              {showDatePicker && courierStatsPeriod === "custom" && (
                <View style={styles.datePickerContainer}>
                  <View style={styles.dateInputRow}>
                    <View style={styles.dateInputGroup}>
                      <Text style={styles.dateInputLabel}>מתאריך</Text>
                      <Pressable
                        style={styles.dateInputButton}
                        onPress={() => openDatePicker("start")}
                        testID="courier-stats-start-date"
                      >
                        <Calendar color={Colors.light.tint} size={16} />
                        <Text style={[styles.dateInputButtonText, !courierStatsStartDate && styles.dateInputPlaceholder]}>
                          {courierStatsStartDate || "בחר תאריך"}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.dateInputGroup}>
                      <Text style={styles.dateInputLabel}>עד תאריך</Text>
                      <Pressable
                        style={styles.dateInputButton}
                        onPress={() => openDatePicker("end")}
                        testID="courier-stats-end-date"
                      >
                        <Calendar color={Colors.light.tint} size={16} />
                        <Text style={[styles.dateInputButtonText, !courierStatsEndDate && styles.dateInputPlaceholder]}>
                          {courierStatsEndDate || "בחר תאריך"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  {(courierStatsStartDate || courierStatsEndDate) ? (
                    <Pressable
                      onPress={() => { setCourierStatsStartDate(""); setCourierStatsEndDate(""); }}
                      style={styles.clearDatesButton}
                    >
                      <X color={Colors.light.secondaryText} size={14} />
                      <Text style={styles.clearDatesText}>נקה תאריכים</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              {courierStatsByPeriod.length === 0 ? (
                <View style={styles.emptyStatsCard}>
                  <Text style={styles.emptyStatsText}>אין נתונים לתקופה הנבחרת</Text>
                </View>
              ) : (
              <View style={styles.breakdownList}>
                {courierStatsByPeriod.map((stat) => {
                  const isAvailable = stat.courier.courierProfile?.isAvailable ?? false;
                  return (
                  <View key={stat.courier.id} style={styles.breakdownCard}>
                    <View style={styles.breakdownCardHeader}>
                      <View style={styles.breakdownNameWithStatus}>
                        <View style={[styles.availabilityDot, isAvailable ? styles.availabilityDotActive : styles.availabilityDotInactive]} />
                        <Text style={styles.breakdownCardName}>{stat.courier.name}</Text>
                      </View>
                      <View style={styles.breakdownBadge}>
                        <Text style={styles.breakdownBadgeText}>{Math.round(stat.completionRate * 100)}%</Text>
                      </View>
                    </View>
                    <View style={styles.breakdownStatsRow}>
                      <View style={styles.breakdownStatItem}>
                        <Text style={styles.breakdownStatValue}>{stat.total}</Text>
                        <Text style={styles.breakdownStatLabel}>סה״כ</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <Text style={[styles.breakdownStatValue, styles.completedText]}>{stat.completed}</Text>
                        <Text style={styles.breakdownStatLabel}>הושלמו</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <Text style={[styles.breakdownStatValue, styles.takenText]}>{stat.taken}</Text>
                        <Text style={styles.breakdownStatLabel}>בדרך</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <View style={styles.earningsValueContainer}>
                          <Text style={styles.shekelSymbol}>₪</Text>
                          <Text style={[styles.breakdownStatValue, styles.earningsText]}>{stat.earnings}</Text>
                        </View>
                        <Text style={styles.breakdownStatLabel}>הכנסות</Text>
                      </View>
                    </View>
                  </View>
                  );
                })}
              </View>
              )}
            </View>

          <View style={styles.statsBreakdownSection}>
              <View style={styles.breakdownHeader}>
                <Store color={Colors.light.tint} size={18} />
                <Text style={styles.breakdownTitle}>נתונים לפי עסק</Text>
              </View>
              <View style={styles.searchInputContainer}>
                <Search color={Colors.light.secondaryText} size={18} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="חפש עסק לפי שם..."
                  placeholderTextColor="rgba(15, 23, 42, 0.35)"
                  value={businessSearchQuery}
                  onChangeText={setBusinessSearchQuery}
                  testID="business-search-input"
                />
                {businessSearchQuery.length > 0 && (
                  <Pressable onPress={() => setBusinessSearchQuery("")} style={styles.clearSearchButton}>
                    <X color={Colors.light.secondaryText} size={16} />
                  </Pressable>
                )}
              </View>
              <View style={styles.courierPeriodToggle}>
                <Pressable
                  onPress={() => { setBusinessStatsPeriod("daily"); setShowBusinessDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    businessStatsPeriod === "daily" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="business-stats-daily"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      businessStatsPeriod === "daily" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    יומי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setBusinessStatsPeriod("weekly"); setShowBusinessDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    businessStatsPeriod === "weekly" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="business-stats-weekly"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      businessStatsPeriod === "weekly" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    שבועי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setBusinessStatsPeriod("monthly"); setShowBusinessDatePicker(false); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    businessStatsPeriod === "monthly" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="business-stats-monthly"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      businessStatsPeriod === "monthly" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    חודשי
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setBusinessStatsPeriod("custom"); setShowBusinessDatePicker(true); }}
                  style={[
                    styles.courierPeriodToggleButton,
                    businessStatsPeriod === "custom" ? styles.courierPeriodToggleButtonActive : styles.courierPeriodToggleButtonInactive,
                  ]}
                  testID="business-stats-custom"
                >
                  <Text
                    style={[
                      styles.courierPeriodToggleText,
                      businessStatsPeriod === "custom" ? styles.courierPeriodToggleTextActive : styles.courierPeriodToggleTextInactive,
                    ]}
                  >
                    תאריכים
                  </Text>
                </Pressable>
              </View>

              {showBusinessDatePicker && businessStatsPeriod === "custom" && (
                <View style={styles.datePickerContainer}>
                  <View style={styles.dateInputRow}>
                    <View style={styles.dateInputGroup}>
                      <Text style={styles.dateInputLabel}>מתאריך</Text>
                      <Pressable
                        style={styles.dateInputButton}
                        onPress={() => openBusinessDatePicker("start")}
                        testID="business-stats-start-date"
                      >
                        <Calendar color={Colors.light.tint} size={16} />
                        <Text style={[styles.dateInputButtonText, !businessStatsStartDate && styles.dateInputPlaceholder]}>
                          {businessStatsStartDate || "בחר תאריך"}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.dateInputGroup}>
                      <Text style={styles.dateInputLabel}>עד תאריך</Text>
                      <Pressable
                        style={styles.dateInputButton}
                        onPress={() => openBusinessDatePicker("end")}
                        testID="business-stats-end-date"
                      >
                        <Calendar color={Colors.light.tint} size={16} />
                        <Text style={[styles.dateInputButtonText, !businessStatsEndDate && styles.dateInputPlaceholder]}>
                          {businessStatsEndDate || "בחר תאריך"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  {(businessStatsStartDate || businessStatsEndDate) ? (
                    <Pressable
                      onPress={() => { setBusinessStatsStartDate(""); setBusinessStatsEndDate(""); }}
                      style={styles.clearDatesButton}
                    >
                      <X color={Colors.light.secondaryText} size={14} />
                      <Text style={styles.clearDatesText}>נקה תאריכים</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              {businessStatsByPeriod.length === 0 ? (
                <View style={styles.emptyStatsCard}>
                  <Text style={styles.emptyStatsText}>אין נתונים לתקופה הנבחרת</Text>
                </View>
              ) : (
              <View style={styles.breakdownList}>
                {businessStatsByPeriod.map((stat) => (
                  <View key={stat.business.id} style={styles.breakdownCard}>
                    <View style={styles.breakdownCardHeader}>
                      <Text style={styles.breakdownCardName}>{stat.business.name}</Text>
                      <View style={styles.breakdownBadge}>
                        <Text style={styles.breakdownBadgeText}>{Math.round(stat.completionRate * 100)}%</Text>
                      </View>
                    </View>
                    <View style={styles.breakdownStatsRow}>
                      <View style={styles.breakdownStatItem}>
                        <Text style={styles.breakdownStatValue}>{stat.total}</Text>
                        <Text style={styles.breakdownStatLabel}>סה״כ</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <Text style={[styles.breakdownStatValue, styles.completedText]}>{stat.completed}</Text>
                        <Text style={styles.breakdownStatLabel}>הושלמו</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <Text style={[styles.breakdownStatValue, styles.waitingText]}>{stat.waiting}</Text>
                        <Text style={styles.breakdownStatLabel}>ממתינים</Text>
                      </View>
                      <View style={styles.breakdownStatItem}>
                        <View style={styles.earningsValueContainer}>
                          <Text style={styles.expenseSymbol}>₪</Text>
                          <Text style={[styles.breakdownStatValue, styles.expenseText]}>{stat.expenses}</Text>
                        </View>
                        <Text style={styles.breakdownStatLabel}>הוצאות</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              )}
            </View>
        </View>

        <View style={styles.section} testID="management-deliveries">
          <View style={styles.sectionHeader}>
            <Truck color={Colors.light.tint} size={20} />
            <Text style={styles.sectionTitle}>שליטה במשלוחים</Text>
          </View>
          <Text style={styles.sectionSubtitle}>הקצו משלוחים לשליחים וסיימו הזמנות בזמן אמת</Text>
          <View style={styles.deliveryList}>
            {waitingDeliveries.length === 0 ? (
              <View style={styles.emptyCard} testID="waiting-empty">
                <AlertTriangle color={Colors.light.tint} size={22} />
                <Text style={styles.emptyTitle}>אין משלוחים שממתינים לשיוך</Text>
                <Text style={styles.emptySubtitle}>כל המשלוחים נמצאים בתהליך</Text>
              </View>
            ) : (
              waitingDeliveries.map((delivery) => (
                <View key={delivery.id} style={styles.deliveryCard} testID={`waiting-${delivery.id}`}>
                  <View style={styles.deliveryHeader}>
                    <View style={styles.deliveryAddresses}>
                      <View style={styles.addressRow}>
                        <MapPin color={Colors.light.waiting} size={16} />
                        <Text style={styles.addressLabel}>איסוף</Text>
                        <Text style={styles.addressValue}>{delivery.pickupAddress}</Text>
                      </View>
                      <View style={styles.addressRow}>
                        <MapPin color={Colors.light.completed} size={16} />
                        <Text style={styles.addressLabel}>יעד</Text>
                        <Text style={styles.addressValue}>{delivery.dropoffAddress}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => toggleDeliveryExpansion(delivery.id)}
                      style={styles.expandButton}
                      testID={`expand-${delivery.id}`}
                    >
                      <Text style={styles.expandText}>שיוך שליח</Text>
                      <ChevronDown color={Colors.light.tint} size={16} />
                    </Pressable>
                  </View>
                  {expandedDeliveryId === delivery.id ? (
                    <View style={styles.assignList}>
                      {couriers.length === 0 ? (
                        <Text style={styles.emptyAssignText}>אין שליחים רשומים במערכת</Text>
                      ) : (
                        couriers.map((courier) => (
                          <Pressable
                            key={courier.id}
                            onPress={() => handleManagerAction(delivery.id, "taken", courier.id)}
                            disabled={isManagerActionLoading}
                            style={[styles.assignButton, isManagerActionLoading && styles.disabledButton]}
                            testID={`assign-${delivery.id}-${courier.id}`}
                          >
                            <Users color={Colors.light.surface} size={16} />
                            <Text style={styles.assignText}>{courier.name}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {activeDeliveries.length > 0 ? (
            <View style={styles.activeBlock} testID="active-deliveries">
              <Text style={styles.sectionSubtitle}>מעקב אחרי משלוחים שנמצאים בדרך</Text>
              {activeDeliveries.map((delivery) => (
                <View key={delivery.id} style={styles.activeCard} testID={`active-${delivery.id}`}>
                  <View style={styles.activeRow}>
                    <Text style={styles.activeTitle}>{delivery.dropoffAddress}</Text>
                    <Text style={styles.activeCourierLabel}>
                      {couriers.find((candidate) => candidate.id === delivery.courierId)?.name ?? "ללא שליח"}
                    </Text>
                  </View>
                  <View style={styles.activeActions}>
                    <Pressable
                      onPress={() => handleManagerAction(delivery.id, "completed")}
                      disabled={isManagerActionLoading}
                      style={[styles.actionChip, styles.completeChip, isManagerActionLoading && styles.disabledButton]}
                      testID={`complete-${delivery.id}`}
                    >
                      <CheckCircle color={Colors.light.surface} size={16} />
                      <Text style={styles.actionChipText}>סמן כמושלם</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleManagerAction(delivery.id, "waiting", null)}
                      disabled={isManagerActionLoading}
                      style={[styles.actionChip, styles.releaseChip, isManagerActionLoading && styles.disabledButton]}
                      testID={`release-${delivery.id}`}
                    >
                      <AlertTriangle color={Colors.light.surface} size={16} />
                      <Text style={styles.actionChipText}>שחרר לשיוך מחדש</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section} testID="management-finance">
          <View style={styles.sectionHeader}>
            <Wallet color={Colors.light.tint} size={20} />
            <Text style={styles.sectionTitle}>מצב כספי</Text>
          </View>
          <Text style={styles.sectionSubtitle}>נתוני אומדן לפי פעילות משלוחים</Text>
          <View style={styles.periodToggle}>
            <Pressable
              onPress={() => { setFinancePeriod("daily"); setShowFinanceDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                financePeriod === "daily" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="finance-period-daily"
            >
              <Calendar
                color={financePeriod === "daily" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  financePeriod === "daily" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                יומי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setFinancePeriod("weekly"); setShowFinanceDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                financePeriod === "weekly" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="finance-period-weekly"
            >
              <CalendarDays
                color={financePeriod === "weekly" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  financePeriod === "weekly" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                שבועי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setFinancePeriod("monthly"); setShowFinanceDatePicker(false); }}
              style={[
                styles.periodToggleButton,
                financePeriod === "monthly" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="finance-period-monthly"
            >
              <CalendarDays
                color={financePeriod === "monthly" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  financePeriod === "monthly" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                חודשי
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setFinancePeriod("custom"); setShowFinanceDatePicker(true); }}
              style={[
                styles.periodToggleButton,
                financePeriod === "custom" ? styles.periodToggleButtonActive : styles.periodToggleButtonInactive,
              ]}
              testID="finance-period-custom"
            >
              <CalendarDays
                color={financePeriod === "custom" ? Colors.light.surface : Colors.light.tint}
                size={16}
              />
              <Text
                style={[
                  styles.periodToggleText,
                  financePeriod === "custom" ? styles.periodToggleTextActive : styles.periodToggleTextInactive,
                ]}
              >
                תאריכים
              </Text>
            </Pressable>
          </View>

          {showFinanceDatePicker && financePeriod === "custom" && (
            <View style={styles.datePickerContainer}>
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>מתאריך</Text>
                  <Pressable
                    style={styles.dateInputButton}
                    onPress={() => openFinanceDatePicker("start")}
                    testID="finance-stats-start-date"
                  >
                    <Calendar color={Colors.light.tint} size={16} />
                    <Text style={[styles.dateInputButtonText, !financeStartDate && styles.dateInputPlaceholder]}>
                      {financeStartDate || "בחר תאריך"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>עד תאריך</Text>
                  <Pressable
                    style={styles.dateInputButton}
                    onPress={() => openFinanceDatePicker("end")}
                    testID="finance-stats-end-date"
                  >
                    <Calendar color={Colors.light.tint} size={16} />
                    <Text style={[styles.dateInputButtonText, !financeEndDate && styles.dateInputPlaceholder]}>
                      {financeEndDate || "בחר תאריך"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {(financeStartDate || financeEndDate) ? (
                <Pressable
                  onPress={() => { setFinanceStartDate(""); setFinanceEndDate(""); }}
                  style={styles.clearDatesButton}
                >
                  <X color={Colors.light.secondaryText} size={14} />
                  <Text style={styles.clearDatesText}>נקה תאריכים</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={styles.financeGrid}>
            <View style={styles.financeCard}>
              <Text style={styles.financeLabel}>סה״כ נגבה (הושלם)</Text>
              <Text style={styles.financeValue}>{currencyFormatter.format(financeSnapshot.totalCollected)}</Text>
            </View>
            <View style={styles.financeCard}>
              <Text style={styles.financeLabel}>ממתין לגביה</Text>
              <Text style={styles.financeValue}>{currencyFormatter.format(financeSnapshot.pendingCollection)}</Text>
            </View>
            <View style={styles.financeCard}>
              <Text style={styles.financeLabel}>בדרך לגביה</Text>
              <Text style={styles.financeValue}>{currencyFormatter.format(financeSnapshot.inProgressCollection)}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>עסקים פעילים: {businesses.length}</Text>
            <Text style={styles.summaryText}>שליחים זמינים: {couriers.length}</Text>
            <Text style={styles.summaryText}>מנהלים: {managers.length}</Text>
          </View>
        </View>
      </ScrollView>
      )}

      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={[styles.tabButton, activeTab === "dashboard" && styles.tabButtonActive]}
          onPress={() => setActiveTab("dashboard")}
          testID="tab-dashboard"
        >
          <LayoutDashboard
            color={activeTab === "dashboard" ? Colors.light.tint : Colors.light.secondaryText}
            size={22}
          />
          <Text style={[styles.tabButtonText, activeTab === "dashboard" && styles.tabButtonTextActive]}>
            לוח בקרה
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "map" && styles.tabButtonActive]}
          onPress={() => setActiveTab("map")}
          testID="tab-map"
        >
          <Map
            color={activeTab === "map" ? Colors.light.tint : Colors.light.secondaryText}
            size={22}
          />
          <Text style={[styles.tabButtonText, activeTab === "map" && styles.tabButtonTextActive]}>
            מפת שליחים
          </Text>
        </Pressable>
      </View>

      <UserEditModal
        visible={isEditModalVisible}
        user={editingUser}
        isLoading={managerUpdateUserMutationStatus === "pending"}
        onClose={handleCloseEditModal}
        onSave={handleSaveUserEdit}
      />

      <Modal
        visible={showCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <Pressable style={styles.calendarModalOverlay} onPress={() => setShowCalendarModal(false)}>
          <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={goToNextMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "90deg" }] }} />
              </Pressable>
              <Text style={styles.calendarMonthText}>{formatMonthYear(calendarMonth)}</Text>
              <Pressable onPress={goToPrevMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "-90deg" }] }} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekDays}>
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((day, index) => (
                <Text key={index} style={styles.calendarWeekDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarDaysGrid}>
              {getCalendarDays().map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const isSelected = 
                  (activeDateField === "start" && courierStatsStartDate === day.toISOString().split("T")[0]) ||
                  (activeDateField === "end" && courierStatsEndDate === day.toISOString().split("T")[0]);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isToday && !isSelected && styles.calendarDayToday,
                    ]}
                    onPress={() => handleSelectDate(day)}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isToday && !isSelected && styles.calendarDayTextToday,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.calendarCloseButton} onPress={() => setShowCalendarModal(false)}>
              <Text style={styles.calendarCloseButtonText}>סגור</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBusinessCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBusinessCalendarModal(false)}
      >
        <Pressable style={styles.calendarModalOverlay} onPress={() => setShowBusinessCalendarModal(false)}>
          <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={goToNextBusinessMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "90deg" }] }} />
              </Pressable>
              <Text style={styles.calendarMonthText}>{formatMonthYear(businessCalendarMonth)}</Text>
              <Pressable onPress={goToPrevBusinessMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "-90deg" }] }} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekDays}>
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((day, index) => (
                <Text key={index} style={styles.calendarWeekDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarDaysGrid}>
              {getBusinessCalendarDays().map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const isSelected = 
                  (businessCalendarField === "start" && businessStatsStartDate === day.toISOString().split("T")[0]) ||
                  (businessCalendarField === "end" && businessStatsEndDate === day.toISOString().split("T")[0]);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isToday && !isSelected && styles.calendarDayToday,
                    ]}
                    onPress={() => handleSelectBusinessDate(day)}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isToday && !isSelected && styles.calendarDayTextToday,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.calendarCloseButton} onPress={() => setShowBusinessCalendarModal(false)}>
              <Text style={styles.calendarCloseButtonText}>סגור</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBriefCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBriefCalendarModal(false)}
      >
        <Pressable style={styles.calendarModalOverlay} onPress={() => setShowBriefCalendarModal(false)}>
          <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={goToNextBriefMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "90deg" }] }} />
              </Pressable>
              <Text style={styles.calendarMonthText}>{formatMonthYear(briefCalendarMonth)}</Text>
              <Pressable onPress={goToPrevBriefMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "-90deg" }] }} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekDays}>
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((day, index) => (
                <Text key={index} style={styles.calendarWeekDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarDaysGrid}>
              {getBriefCalendarDays().map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const isSelected = 
                  (briefCalendarField === "start" && briefStatsStartDate === day.toISOString().split("T")[0]) ||
                  (briefCalendarField === "end" && briefStatsEndDate === day.toISOString().split("T")[0]);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isToday && !isSelected && styles.calendarDayToday,
                    ]}
                    onPress={() => handleSelectBriefDate(day)}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isToday && !isSelected && styles.calendarDayTextToday,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.calendarCloseButton} onPress={() => setShowBriefCalendarModal(false)}>
              <Text style={styles.calendarCloseButtonText}>סגור</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showFinanceCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFinanceCalendarModal(false)}
      >
        <Pressable style={styles.calendarModalOverlay} onPress={() => setShowFinanceCalendarModal(false)}>
          <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={goToNextFinanceMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "90deg" }] }} />
              </Pressable>
              <Text style={styles.calendarMonthText}>{formatMonthYear(financeCalendarMonth)}</Text>
              <Pressable onPress={goToPrevFinanceMonth} style={styles.calendarNavButton}>
                <ChevronDown color={Colors.light.tint} size={20} style={{ transform: [{ rotate: "-90deg" }] }} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekDays}>
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((day, index) => (
                <Text key={index} style={styles.calendarWeekDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarDaysGrid}>
              {getFinanceCalendarDays().map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const isSelected = 
                  (financeCalendarField === "start" && financeStartDate === day.toISOString().split("T")[0]) ||
                  (financeCalendarField === "end" && financeEndDate === day.toISOString().split("T")[0]);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isToday && !isSelected && styles.calendarDayToday,
                    ]}
                    onPress={() => handleSelectFinanceDate(day)}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isToday && !isSelected && styles.calendarDayTextToday,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.calendarCloseButton} onPress={() => setShowFinanceCalendarModal(false)}>
              <Text style={styles.calendarCloseButtonText}>סגור</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  headerContainer: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "flex-end",
    paddingBottom: 24,
    gap: 16,
  },
  headerTitles: {
    alignItems: "flex-end",
    gap: 4,
  },
  managerLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    writingDirection: "rtl",
  },
  managerName: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  managerSubLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    writingDirection: "rtl",
  },
  headerActionButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    zIndex: 20,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 28,
  },
  section: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 24,
    gap: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 209, 0.2)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  sectionSubtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  directoryToggle: {
    flexDirection: "row-reverse",
    gap: 8,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 18,
    padding: 6,
  },
  directoryToggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 14,
  },
  directoryToggleButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  directoryToggleButtonInactive: {
    backgroundColor: "transparent",
  },
  directoryToggleText: {
    fontSize: 14,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  directoryToggleTextActive: {
    color: Colors.light.surface,
  },
  directoryToggleTextInactive: {
    color: Colors.light.tint,
  },
  directoryTable: {
    backgroundColor: "#f8faff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    overflow: "hidden",
  },
  directoryHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  directoryHeaderCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  directoryHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  directoryRowsContainer: {
    gap: 12,
    backgroundColor: "transparent",
    padding: 16,
  },
  directoryRowCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    padding: 18,
    gap: 12,
  },
  directoryRowHeader: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    marginBottom: 4,
  },
  editUserButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editUserButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  impersonateButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  impersonateButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  directoryDetailRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  directoryDetailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  directoryDetailValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
  },
  directoryEmptyText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
    textAlign: "right",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  registrationToggle: {
    flexDirection: "row-reverse",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderRadius: 20,
    padding: 6,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 16,
  },
  toggleButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  toggleButtonInactive: {
    backgroundColor: "transparent",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  toggleTextActive: {
    color: Colors.light.surface,
  },
  toggleTextInactive: {
    color: Colors.light.tint,
  },
  formContainer: {
    gap: 18,
    backgroundColor: "#f8faff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  inputsColumn: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
    alignItems: "flex-end",
  },
  inputRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.18)",
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 14,
    color: Colors.light.text,
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  buttonLoader: {
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  statsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexBasis: "48%",
    backgroundColor: "#f1f5ff",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "flex-end",
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  waitingText: {
    color: Colors.light.waiting,
  },
  takenText: {
    color: Colors.light.taken,
  },
  completedText: {
    color: Colors.light.completed,
  },
  completionRow: {
    gap: 12,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  completionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  completionValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.surface,
    backgroundColor: Colors.light.completed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    writingDirection: "rtl",
  },
  completionBarBackground: {
    height: 10,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 209, 0.3)",
    overflow: "hidden",
  },
  completionBarFill: {
    height: "100%",
    backgroundColor: Colors.light.completed,
  },
  deliveryList: {
    gap: 16,
  },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  deliveryCard: {
    backgroundColor: "#f8f9ff",
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  deliveryAddresses: {
    flex: 1,
    gap: 8,
    alignItems: "flex-end",
  },
  addressRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  addressValue: {
    fontSize: 15,
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  expandText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  assignList: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  emptyAssignText: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  assignText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  disabledButton: {
    opacity: 0.6,
  },
  activeBlock: {
    gap: 14,
    marginTop: 12,
  },
  activeCard: {
    backgroundColor: "#fdf5e6",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.24)",
  },
  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  activeCourierLabel: {
    fontSize: 14,
    color: Colors.light.taken,
    writingDirection: "rtl",
  },
  activeActions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  completeChip: {
    backgroundColor: Colors.light.completed,
  },
  releaseChip: {
    backgroundColor: Colors.light.taken,
  },
  actionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  courierList: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  courierCard: {
    width: "48%",
    backgroundColor: "#eef2ff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    gap: 10,
    alignItems: "flex-end",
  },
  courierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  },
  courierName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
    textAlign: "right",
  },
  courierBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  courierBadgeAvailable: {
    backgroundColor: Colors.light.completed,
  },
  courierBadgeUnavailable: {
    backgroundColor: "#94a3b8",
  },
  courierBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
  courierDetailsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  courierDetail: {
    flexBasis: "48%",
    backgroundColor: "#f8faff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  courierDetailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  courierDetailTexts: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  courierDetailLabel: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  courierDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  courierFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  courierFooterLabel: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  courierFooterValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.tintDark,
    writingDirection: "rtl",
  },
  topCouriers: {
    gap: 12,
  },
  topRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  topCard: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "flex-end",
    gap: 6,
  },
  topName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  topValue: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  financeGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  financeCard: {
    flexBasis: "48%",
    backgroundColor: "#ecfdf5",
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  financeLabel: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  financeValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  periodToggle: {
    flexDirection: "row-reverse",
    gap: 8,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 18,
    padding: 6,
  },
  periodToggleButton: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
  },
  periodToggleButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  periodToggleButtonInactive: {
    backgroundColor: "transparent",
  },
  periodToggleText: {
    fontSize: 14,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  periodToggleTextActive: {
    color: Colors.light.surface,
  },
  periodToggleTextInactive: {
    color: Colors.light.tint,
  },
  statsBreakdownSection: {
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 209, 0.2)",
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  breakdownList: {
    gap: 10,
  },
  breakdownCard: {
    backgroundColor: "#f8faff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.1)",
  },
  breakdownCardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownCardName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  breakdownBadge: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  breakdownBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.surface,
  },
  breakdownStatsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
  },
  breakdownStatItem: {
    alignItems: "center",
    gap: 4,
  },
  breakdownStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.light.text,
  },
  breakdownStatLabel: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  breakdownNameWithStatus: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityDotActive: {
    backgroundColor: Colors.light.completed,
  },
  availabilityDotInactive: {
    backgroundColor: "#94a3b8",
  },
  courierPeriodToggle: {
    flexDirection: "row-reverse",
    gap: 6,
    backgroundColor: "rgba(59, 130, 246, 0.06)",
    borderRadius: 14,
    padding: 4,
  },
  courierPeriodToggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  courierPeriodToggleButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  courierPeriodToggleButtonInactive: {
    backgroundColor: "transparent",
  },
  courierPeriodToggleText: {
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  courierPeriodToggleTextActive: {
    color: Colors.light.surface,
  },
  courierPeriodToggleTextInactive: {
    color: Colors.light.tint,
  },
  datePickerContainer: {
    backgroundColor: "#f8faff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  dateInputRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
    gap: 6,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
    textAlign: "right",
  },
  dateInputButton: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.15)",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  dateInputButtonText: {
    fontSize: 13,
    color: Colors.light.text,
    writingDirection: "rtl",
    flex: 1,
    textAlign: "right",
  },
  dateInputPlaceholder: {
    color: "rgba(15, 23, 42, 0.35)",
  },
  clearDatesButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  clearDatesText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  emptyStatsCard: {
    backgroundColor: "#f8faff",
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyStatsText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  searchInputContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#f8faff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  earningsValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  earningsText: {
    color: Colors.light.completed,
  },
  shekelSymbol: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.light.completed,
  },
  expenseSymbol: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#ef4444",
  },
  expenseText: {
    color: "#ef4444",
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  calendarModalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 340,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  calendarWeekDays: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    width: 36,
    textAlign: "center",
  },
  calendarDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayEmpty: {
    width: "14.28%",
    aspectRatio: 1,
  },
  calendarDaySelected: {
    backgroundColor: Colors.light.tint,
    borderRadius: 18,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 18,
  },
  calendarDayText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  calendarDayTextSelected: {
    color: Colors.light.surface,
    fontWeight: "700",
  },
  calendarDayTextToday: {
    color: Colors.light.tint,
    fontWeight: "700",
  },
  calendarCloseButton: {
    marginTop: 16,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  calendarCloseButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  tabBar: {
    flexDirection: "row-reverse",
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 209, 0.2)",
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  tabButtonActive: {},
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  tabButtonTextActive: {
    color: Colors.light.tint,
  },
  fullScreenMapWrapper: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
