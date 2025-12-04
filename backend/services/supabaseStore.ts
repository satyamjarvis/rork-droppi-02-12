import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Customer, Delivery, DeliveryStatus, User, UserRole } from "@/types/models";
import { systemEvents } from "./eventEmitter";
import { getDistanceFromAddresses } from "@/utils/distanceCalculator";

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const cleanAddress = address.replace(/\s*\([^)]*\)\s*/g, "").trim();
    const encodedAddress = encodeURIComponent(cleanAddress);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DeliveryApp/1.0",
      },
    });

    if (!response.ok) {
      console.log("Geocoding API request failed", { status: response.status });
      return null;
    }

    const data = (await response.json()) as { lat: string; lon: string }[];

    if (data.length === 0) {
      console.log("No geocoding results for address", cleanAddress);
      return null;
    }

    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      console.log("Invalid coordinates from geocoding", { lat: result.lat, lon: result.lon });
      return null;
    }

    console.log("Geocoding successful", { address: cleanAddress, latitude, longitude });
    return { latitude, longitude };
  } catch (error) {
    console.log("Geocoding error", error);
    return null;
  }
}

function appendCoordinatesToAddress(address: string, coords: { latitude: number; longitude: number } | null): string {
  if (!coords) {
    return address;
  }
  const cleanAddress = address.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return `${cleanAddress} (${coords.latitude}, ${coords.longitude})`;
}

const PHONE_MIN_DIGITS = 9;

const normalizePhoneNumber = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasLeadingPlus ? `+${digits}` : digits;
};

const createPhoneComparisonKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972") && digits.length >= 11) {
    const rest = digits.slice(3);
    return rest.startsWith("0") ? rest.slice(1) : rest;
  }
  if (digits.startsWith("0") && digits.length >= PHONE_MIN_DIGITS) {
    return digits.slice(1);
  }
  return digits;
};

const countDigits = (value: string): number => value.replace(/\D/g, "").length;

const isValidNormalizedPhone = (phone: string): boolean => {
  return countDigits(phone) >= PHONE_MIN_DIGITS;
};

const roleErrorMessages: Record<UserRole, string> = {
  manager: "גישה מותרת רק למנהלים מחוברים",
  business: "הפעולה זמינה רק לחשבונות עסק",
  courier: "גישה מותרת רק לשליחים",
};

const assertRole = (user: User | undefined, role: UserRole, context: string) => {
  if (!user) {
    console.log("Role assertion failed - missing user", { context, role });
    throw new Error("החשבון המבצע לא נמצא. התנתקו והתחברו מחדש.");
  }
  if (user.role !== role) {
    console.log("Role assertion failed - mismatched role", { context, expectedRole: role, actualRole: user.role });
    throw new Error(roleErrorMessages[role]);
  }
};

const generateId = () => `${Date.now()}-${Math.round(Math.random() * 100000)}`;

type DbUser = {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: string;
  email: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
  courier_profiles?: {
    age: number;
    email: string;
    vehicle: string;
    is_available: boolean;
    id_number: string | null;
    current_latitude: number | null;
    current_longitude: number | null;
    location_updated_at: string | null;
  }[] | null;
  business_profiles?: {
    address: string;
    email: string;
  }[] | null;
};

type DbCustomer = {
  id: string;
  phone: string;
  name: string;
  address: string | null;
  city: string | null;
  floor: string | null;
  notes: string | null;
  business_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbDelivery = {
  id: string;
  business_id: string;
  courier_id: string | null;
  pickup_address: string;
  dropoff_address: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  preparation_time_minutes: number | null;
  estimated_arrival_minutes: number | null;
  business_confirmed: boolean;
  confirmed_at: string | null;
  business_ready: boolean;
  picked_up_at: string | null;
  completed_at: string | null;
  customer_name: string;
  customer_phone: string;
  payment: number | null;
  distance_km: number | null;
};

function dbUserToUser(dbUser: DbUser): User {
  const user: User = {
    id: dbUser.id,
    name: dbUser.name,
    phone: dbUser.phone,
    password: dbUser.password,
    role: dbUser.role as UserRole,
    email: dbUser.email ?? undefined,
    pushToken: dbUser.push_token ?? undefined,
  };

  if (dbUser.role === "courier" && dbUser.courier_profiles && dbUser.courier_profiles.length > 0) {
    const profile = dbUser.courier_profiles[0];
    user.courierProfile = {
      age: profile.age,
      email: profile.email,
      vehicle: profile.vehicle,
      isAvailable: profile.is_available,
      idNumber: profile.id_number ?? undefined,
      currentLocation: profile.current_latitude !== null && profile.current_longitude !== null ? {
        latitude: profile.current_latitude,
        longitude: profile.current_longitude,
        updatedAt: profile.location_updated_at ?? new Date().toISOString(),
      } : undefined,
    };
  }

  if (dbUser.role === "business" && dbUser.business_profiles && dbUser.business_profiles.length > 0) {
    const profile = dbUser.business_profiles[0];
    user.businessProfile = {
      address: profile.address,
      email: profile.email,
    };
  }

  return user;
}

function dbCustomerToCustomer(dbCustomer: DbCustomer): Customer {
  return {
    id: dbCustomer.id,
    phone: dbCustomer.phone,
    name: dbCustomer.name,
    address: dbCustomer.address ?? undefined,
    city: dbCustomer.city ?? undefined,
    floor: dbCustomer.floor ?? undefined,
    notes: dbCustomer.notes ?? undefined,
    businessId: dbCustomer.business_id ?? undefined,
    createdAt: dbCustomer.created_at,
    updatedAt: dbCustomer.updated_at,
  };
}

function dbDeliveryToDelivery(dbDelivery: DbDelivery): Delivery {
  return {
    id: dbDelivery.id,
    businessId: dbDelivery.business_id,
    courierId: dbDelivery.courier_id,
    pickupAddress: dbDelivery.pickup_address,
    dropoffAddress: dbDelivery.dropoff_address,
    notes: dbDelivery.notes,
    status: dbDelivery.status as DeliveryStatus,
    createdAt: dbDelivery.created_at,
    preparationTimeMinutes: dbDelivery.preparation_time_minutes ?? undefined,
    estimatedArrivalMinutes: dbDelivery.estimated_arrival_minutes ?? undefined,
    businessConfirmed: dbDelivery.business_confirmed,
    confirmedAt: dbDelivery.confirmed_at ?? undefined,
    businessReady: dbDelivery.business_ready,
    pickedUpAt: dbDelivery.picked_up_at ?? undefined,
    completedAt: dbDelivery.completed_at ?? undefined,
    customerName: dbDelivery.customer_name,
    customerPhone: dbDelivery.customer_phone,
    payment: dbDelivery.payment ?? undefined,
    distanceKm: dbDelivery.distance_km ?? undefined,
  };
}

export const supabaseStore = {
  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      console.log("[SUPABASE] Not configured, returning empty users");
      return [];
    }

    console.log("[SUPABASE] Fetching users");
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) {
      console.log("[SUPABASE] Error fetching users:", usersError);
      throw new Error("שגיאה בטעינת המשתמשים");
    }

    const { data: courierProfiles, error: courierError } = await supabase
      .from("courier_profiles")
      .select("*");

    if (courierError) {
      console.log("[SUPABASE] Error fetching courier profiles:", courierError);
    }

    const { data: businessProfiles, error: businessError } = await supabase
      .from("business_profiles")
      .select("*");

    if (businessError) {
      console.log("[SUPABASE] Error fetching business profiles:", businessError);
    }

    const courierProfileMap = new Map<string, { age: number; email: string; vehicle: string; is_available: boolean; id_number: string | null; current_latitude: number | null; current_longitude: number | null; location_updated_at: string | null }>();
    (courierProfiles || []).forEach((profile: { user_id: string; age: number; email: string; vehicle: string; is_available: boolean; id_number: string | null; current_latitude: number | null; current_longitude: number | null; location_updated_at: string | null }) => {
      courierProfileMap.set(profile.user_id, profile);
    });

    const businessProfileMap = new Map<string, { address: string; email: string }>();
    (businessProfiles || []).forEach((profile: { user_id: string; address: string; email: string }) => {
      businessProfileMap.set(profile.user_id, profile);
    });

    console.log("[SUPABASE] Courier profiles map:", Array.from(courierProfileMap.entries()));
    console.log("[SUPABASE] Business profiles map:", Array.from(businessProfileMap.entries()));

    const seenUserIds = new Set<string>();
    const users = (usersData || [])
      .filter((dbUser: unknown) => {
        const rawUser = dbUser as Omit<DbUser, 'courier_profiles' | 'business_profiles'>;
        if (!rawUser.id || typeof rawUser.id !== "string" || rawUser.id.trim() === "") {
          console.log("[SUPABASE] Skipping user with invalid id:", rawUser);
          return false;
        }
        if (seenUserIds.has(rawUser.id)) {
          console.log("[SUPABASE] Skipping duplicate user id:", rawUser.id);
          return false;
        }
        seenUserIds.add(rawUser.id);
        return true;
      })
      .map((dbUser: unknown) => {
        const rawUser = dbUser as Omit<DbUser, 'courier_profiles' | 'business_profiles'>;
        const courierProfile = courierProfileMap.get(rawUser.id);
        const businessProfile = businessProfileMap.get(rawUser.id);
        
        const enrichedUser: DbUser = {
          ...rawUser,
          courier_profiles: courierProfile ? [courierProfile] : null,
          business_profiles: businessProfile ? [businessProfile] : null,
        };
        
        console.log("[SUPABASE] User:", rawUser.id, "role:", rawUser.role, "courierProfile:", courierProfile, "businessProfile:", businessProfile);
        return dbUserToUser(enrichedUser);
      });
    
    console.log("[SUPABASE] Fetched", users.length, "users with profiles (filtered from", usersData?.length || 0, ")");
    return users;
  },

  async getDeliveries(): Promise<Delivery[]> {
    if (!isSupabaseConfigured()) {
      console.log("[SUPABASE] Not configured, returning empty deliveries");
      return [];
    }

    console.log("[SUPABASE] Fetching deliveries");
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("[SUPABASE] Error fetching deliveries:", error);
      throw new Error("שגיאה בטעינת המשלוחים");
    }

    const rawDeliveries = (data || [])
      .filter((dbDelivery: unknown) => {
        const d = dbDelivery as DbDelivery;
        if (!d.id || typeof d.id !== "string" || d.id.trim() === "") {
          console.log("[SUPABASE] Skipping delivery with invalid id:", d);
          return false;
        }
        return true;
      });
    
    const seenIds = new Set<string>();
    const uniqueDeliveries = rawDeliveries.filter((dbDelivery: unknown) => {
      const d = dbDelivery as DbDelivery;
      if (seenIds.has(d.id)) {
        console.log("[SUPABASE] Skipping duplicate delivery id:", d.id);
        return false;
      }
      seenIds.add(d.id);
      return true;
    });
    
    const deliveries = uniqueDeliveries.map((dbDelivery: unknown) => dbDeliveryToDelivery(dbDelivery as DbDelivery));
    console.log("[SUPABASE] Fetched", deliveries.length, "deliveries (filtered from", data?.length || 0, ")");
    return deliveries;
  },

  async getUserById(userId: string): Promise<User | undefined> {
    if (!isSupabaseConfigured()) return undefined;

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.log("[SUPABASE] getUserById - user not found:", userId, userError);
      return undefined;
    }

    const rawUser = userData as Omit<DbUser, 'courier_profiles' | 'business_profiles'>;
    let courierProfile: { age: number; email: string; vehicle: string; is_available: boolean; id_number: string | null; current_latitude: number | null; current_longitude: number | null; location_updated_at: string | null } | null = null;
    let businessProfile: { address: string; email: string } | null = null;

    if (rawUser.role === "courier") {
      const { data: cpData, error: cpError } = await supabase
        .from("courier_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      if (!cpError && cpData) {
        courierProfile = cpData as { age: number; email: string; vehicle: string; is_available: boolean; id_number: string | null; current_latitude: number | null; current_longitude: number | null; location_updated_at: string | null };
        console.log("[SUPABASE] getUserById - found courier profile:", courierProfile);
      } else {
        console.log("[SUPABASE] getUserById - no courier profile found for:", userId, cpError);
      }
    }

    if (rawUser.role === "business") {
      const { data: bpData, error: bpError } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      if (!bpError && bpData) {
        businessProfile = bpData as { address: string; email: string };
        console.log("[SUPABASE] getUserById - found business profile:", businessProfile);
      } else {
        console.log("[SUPABASE] getUserById - no business profile found for:", userId, bpError);
      }
    }

    const enrichedUser: DbUser = {
      ...rawUser,
      courier_profiles: courierProfile ? [courierProfile] : null,
      business_profiles: businessProfile ? [businessProfile] : null,
    };

    console.log("[SUPABASE] getUserById - returning user:", userId, "role:", rawUser.role, "hasCP:", !!courierProfile, "hasBP:", !!businessProfile);
    return dbUserToUser(enrichedUser);
  },

  async login(phone: string, password: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      console.log("[SUPABASE] Login failed - Supabase not configured");
      throw new Error("חיבור לשרת לא זמין - יש להגדיר את Supabase. אנא צור קשר עם התמיכה.");
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || !isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }

    console.log("[SUPABASE] Login attempt for:", normalizedPhone);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SUPABASE] Login attempt ${attempt}/${maxRetries}`);
        
        const timeoutMs = 15000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`[SUPABASE] Login attempt ${attempt} timed out after ${timeoutMs}ms`);
          controller.abort();
        }, timeoutMs);

        const queryPromise = supabase
          .from("users")
          .select(`
            *,
            courier_profiles:courier_profiles!courier_profiles_user_id_fkey(*),
            business_profiles:business_profiles!business_profiles_user_id_fkey(*)
          `)
          .abortSignal(controller.signal);

        const { data: users, error } = await queryPromise;
        clearTimeout(timeoutId);

        if (error) {
          console.log(`[SUPABASE] Login attempt ${attempt} database error:`, error.message, error.code);
          lastError = new Error(error.message || "שגיאה בהתחברות");
          
          if (attempt < maxRetries) {
            const delay = attempt * 1000;
            console.log(`[SUPABASE] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw lastError;
        }

        if (!users || users.length === 0) {
          console.log("[SUPABASE] No users found in database");
          throw new Error("פרטי הכניסה שגויים");
        }

        console.log(`[SUPABASE] Fetched ${users.length} users, searching for match...`);
        const comparisonKey = createPhoneComparisonKey(normalizedPhone);

        const foundUser = users.find((candidate: unknown) => {
          const c = candidate as DbUser;
          const candidateNormalized = normalizePhoneNumber(c.phone);
          const candidateKey = createPhoneComparisonKey(candidateNormalized || c.phone);
          const phonesMatch =
            (!!candidateNormalized && candidateNormalized === normalizedPhone) ||
            (!!candidateKey && !!comparisonKey && candidateKey === comparisonKey);
          return phonesMatch && c.password === password;
        });

        if (!foundUser) {
          console.log("[SUPABASE] No matching user found for credentials");
          throw new Error("פרטי הכניסה שגויים");
        }

        const user = dbUserToUser(foundUser as unknown as DbUser);
        console.log("[SUPABASE] Login successful for:", user.id, "on attempt", attempt);
        return user;

      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.log(`[SUPABASE] Login attempt ${attempt} error:`, errorMessage);
        
        if (errorMessage === "פרטי הכניסה שגויים" || errorMessage === "מספר הטלפון שהוזן אינו תקין") {
          throw fetchError;
        }

        lastError = fetchError instanceof Error ? fetchError : new Error(errorMessage);
        
        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          console.log(`[SUPABASE] Retrying login in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    console.log("[SUPABASE] All login attempts failed");
    throw new Error("שגיאה בהתחברות - נסה שוב מאוחר יותר");
  },

  async registerCourier(payload: {
    managerId: string;
    name: string;
    age: number;
    phone: string;
    email: string;
    vehicle: string;
    password: string;
    idNumber?: string;
  }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    console.log("[SUPABASE] Register courier:", payload.phone);

    const manager = await this.getUserById(payload.managerId);
    if (!manager || manager.role !== "manager") {
      throw new Error("גישה מותרת רק למנהלים מחוברים");
    }

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!payload.name.trim() || !normalizedPhone || !payload.email.trim() || !payload.vehicle.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (!Number.isInteger(payload.age) || payload.age < 18) {
      throw new Error("גיל השליח חייב להיות 18 ומעלה");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const { data: existingUsers } = await supabase
      .from("users")
      .select("phone")
      .eq("phone", normalizedPhone);

    if (existingUsers && existingUsers.length > 0) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const userId = `courier-${generateId()}`;

    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "courier" as const,
      email: payload.email.trim().toLowerCase(),
    } as Record<string, unknown>);

    if (userError) {
      console.log("[SUPABASE] Error creating courier user:", userError);
      throw new Error("שגיאה ביצירת המשתמש");
    }

    const courierProfileData = {
      user_id: userId,
      age: payload.age,
      email: payload.email.trim().toLowerCase(),
      vehicle: payload.vehicle.trim(),
      is_available: false,
      id_number: payload.idNumber?.trim() || null,
    };
    console.log("[SUPABASE] Creating courier profile with data:", courierProfileData);
    
    const { data: insertedProfile, error: profileError } = await supabase
      .from("courier_profiles")
      .insert(courierProfileData as Record<string, unknown>)
      .select();

    if (profileError) {
      console.log("[SUPABASE] Error creating courier profile:", profileError);
      await supabase.from("users").delete().eq("id", userId);
      throw new Error("שגיאה ביצירת פרופיל השליח");
    }
    
    console.log("[SUPABASE] Courier profile created successfully:", insertedProfile);

    const created = await this.getUserById(userId);
    if (!created) {
      throw new Error("שגיאה בטעינת השליח שנוצר");
    }

    console.log("[SUPABASE] Courier registered:", created.id, "profile:", created.courierProfile);
    systemEvents.emitUserCreated(created);
    return created;
  },

  async registerBusiness(payload: {
    managerId: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    console.log("[SUPABASE] Register business:", payload.phone);

    const manager = await this.getUserById(payload.managerId);
    if (!manager || manager.role !== "manager") {
      throw new Error("גישה מותרת רק למנהלים מחוברים");
    }

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!payload.name.trim() || !payload.address.trim() || !normalizedPhone || !payload.email.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const { data: existingUsers } = await supabase
      .from("users")
      .select("phone")
      .eq("phone", normalizedPhone);

    if (existingUsers && existingUsers.length > 0) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const userId = `business-${generateId()}`;

    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "business" as const,
      email: payload.email.trim().toLowerCase(),
    } as Record<string, unknown>);

    if (userError) {
      console.log("[SUPABASE] Error creating business user:", userError);
      throw new Error("שגיאה ביצירת המשתמש");
    }

    const businessProfileData = {
      user_id: userId,
      address: payload.address.trim(),
      email: payload.email.trim().toLowerCase(),
    };
    console.log("[SUPABASE] Creating business profile with data:", businessProfileData);
    
    const { data: insertedProfile, error: profileError } = await supabase
      .from("business_profiles")
      .insert(businessProfileData as Record<string, unknown>)
      .select();

    if (profileError) {
      console.log("[SUPABASE] Error creating business profile:", profileError);
      await supabase.from("users").delete().eq("id", userId);
      throw new Error("שגיאה ביצירת פרופיל העסק");
    }
    
    console.log("[SUPABASE] Business profile created successfully:", insertedProfile);

    const created = await this.getUserById(userId);
    if (!created) {
      throw new Error("שגיאה בטעינת העסק שנוצר");
    }

    console.log("[SUPABASE] Business registered:", created.id, "profile:", created.businessProfile);
    systemEvents.emitUserCreated(created);
    return created;
  },

  async registerManager(payload: {
    managerId: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    console.log("[SUPABASE] Register manager:", payload.phone);

    const manager = await this.getUserById(payload.managerId);
    if (!manager || manager.role !== "manager") {
      throw new Error("גישה מותרת רק למנהלים מחוברים");
    }

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!payload.name.trim() || !normalizedPhone || !payload.email.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const { data: existingUsers } = await supabase
      .from("users")
      .select("phone")
      .eq("phone", normalizedPhone);

    if (existingUsers && existingUsers.length > 0) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const userId = `manager-${generateId()}`;

    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "manager" as const,
      email: payload.email.trim().toLowerCase(),
    } as Record<string, unknown>);

    if (userError) {
      console.log("[SUPABASE] Error creating manager user:", userError);
      throw new Error("שגיאה ביצירת המשתמש");
    }

    const created = await this.getUserById(userId);
    if (!created) {
      throw new Error("שגיאה בטעינת המנהל שנוצר");
    }

    console.log("[SUPABASE] Manager registered:", created.id);
    systemEvents.emitUserCreated(created);
    return created;
  },

  async createDelivery(payload: {
    businessId: string;
    pickupAddress: string;
    dropoffAddress: string;
    notes: string;
    customerName: string;
    customerPhone: string;
    preparationTimeMinutes: number;
  }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const business = await this.getUserById(payload.businessId);
    assertRole(business, "business", "createDelivery");

    if (!payload.pickupAddress.trim() || !payload.dropoffAddress.trim() || !payload.customerName.trim() || !payload.customerPhone.trim()) {
      throw new Error("יש למלא את כל השדות");
    }

    let pickupAddressWithCoords = payload.pickupAddress.trim();
    let dropoffAddressWithCoords = payload.dropoffAddress.trim();

    const [pickupCoords, dropoffCoords] = await Promise.all([
      geocodeAddress(pickupAddressWithCoords),
      geocodeAddress(dropoffAddressWithCoords),
    ]);

    pickupAddressWithCoords = appendCoordinatesToAddress(pickupAddressWithCoords, pickupCoords);
    dropoffAddressWithCoords = appendCoordinatesToAddress(dropoffAddressWithCoords, dropoffCoords);

    const distanceKm = getDistanceFromAddresses(pickupAddressWithCoords, dropoffAddressWithCoords);

    if (distanceKm !== null) {
      console.log("Distance calculated for new delivery:", distanceKm, "km");
    }

    const deliveryId = `delivery-${generateId()}`;

    const { error } = await supabase.from("deliveries").insert({
      id: deliveryId,
      business_id: payload.businessId,
      courier_id: null,
      pickup_address: pickupAddressWithCoords,
      dropoff_address: dropoffAddressWithCoords,
      notes: payload.notes.trim(),
      status: "waiting" as const,
      preparation_time_minutes: payload.preparationTimeMinutes,
      customer_name: payload.customerName.trim(),
      customer_phone: payload.customerPhone.trim(),
      payment: 25,
      distance_km: distanceKm,
    } as Record<string, unknown>);

    if (error) {
      console.log("[SUPABASE] Error creating delivery:", error);
      throw new Error("שגיאה ביצירת המשלוח");
    }

    const { data: createdDelivery } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .single();

    if (!createdDelivery) {
      throw new Error("שגיאה בטעינת המשלוח שנוצר");
    }

    const delivery = dbDeliveryToDelivery(createdDelivery as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery created:", delivery.id);
    systemEvents.emitDeliveryCreated(delivery);
    return delivery;
  },

  async managerUpdateDelivery(payload: {
    managerId: string;
    deliveryId: string;
    status?: DeliveryStatus;
    courierId?: string | null;
  }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const manager = await this.getUserById(payload.managerId);
    if (!manager || manager.role !== "manager") {
      throw new Error("גישה מותרת רק למנהלים מחוברים");
    }

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    const nextStatus: DeliveryStatus = payload.status ?? (currentDelivery.status as DeliveryStatus);
    const resolvedCourierId = typeof payload.courierId !== "undefined" ? payload.courierId : currentDelivery.courier_id;
    const sanitizedCourierId = nextStatus === "waiting" ? null : resolvedCourierId ?? null;

    if (sanitizedCourierId) {
      const courier = await this.getUserById(sanitizedCourierId);
      assertRole(courier, "courier", "managerUpdateDelivery.assign");
    }

    const isAssigningCourier = sanitizedCourierId && !currentDelivery.courier_id && nextStatus === "taken";
    const defaultEstimatedArrival = isAssigningCourier && !currentDelivery.estimated_arrival_minutes ? 15 : undefined;

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      courier_id: sanitizedCourierId,
    };

    if (defaultEstimatedArrival !== undefined) {
      updateData.estimated_arrival_minutes = defaultEstimatedArrival;
      console.log("[SUPABASE] Manager assigning courier with default ETA:", defaultEstimatedArrival, "minutes");
    }

    const { error } = await supabase
      .from("deliveries")
      .update(updateData)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error updating delivery:", error);
      throw new Error("שגיאה בעדכון המשלוח");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    systemEvents.emitDeliveryUpdated(delivery);
    return delivery;
  },

  async courierTakeDelivery(payload: { courierId: string; deliveryId: string; estimatedArrivalMinutes: number }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const courier = await this.getUserById(payload.courierId);
    assertRole(courier, "courier", "courierTakeDelivery");

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    
    if (currentDelivery.courier_id === payload.courierId && currentDelivery.status === "taken") {
      console.log("[SUPABASE] Courier already owns this delivery, returning existing delivery", payload.deliveryId, payload.courierId);
      const delivery = dbDeliveryToDelivery(currentDelivery);
      return delivery;
    }
    
    if (currentDelivery.status !== "waiting") {
      throw new Error("משלוח זה כבר נלקח");
    }

    const { error } = await supabase
      .from("deliveries")
      .update({
        status: "taken" as const,
        courier_id: payload.courierId,
        estimated_arrival_minutes: payload.estimatedArrivalMinutes,
      } as Record<string, unknown>)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error taking delivery:", error);
      throw new Error("שגיאה בלקיחת המשלוח");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery taken:", delivery.id);
    systemEvents.emitDeliveryAssigned(delivery);
    return delivery;
  },

  async courierPickupDelivery(payload: { courierId: string; deliveryId: string }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const courier = await this.getUserById(payload.courierId);
    assertRole(courier, "courier", "courierPickupDelivery");

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    if (currentDelivery.courier_id !== payload.courierId) {
      throw new Error("אין לך הרשאה לאסוף משלוח זה");
    }
    if (currentDelivery.status !== "taken") {
      throw new Error("ניתן לאסוף רק משלוחים שנלקחו על ידי שליח");
    }
    if (!currentDelivery.business_ready) {
      throw new Error("ההזמנה עדיין לא מוכנה לאיסוף");
    }

    const { error } = await supabase
      .from("deliveries")
      .update({
        picked_up_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error picking up delivery:", error);
      throw new Error("שגיאה באיסוף המשלוח");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery picked up:", delivery.id);
    return delivery;
  },

  async courierCompleteDelivery(payload: { courierId: string; deliveryId: string }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const courier = await this.getUserById(payload.courierId);
    assertRole(courier, "courier", "courierCompleteDelivery");

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    if (currentDelivery.courier_id !== payload.courierId) {
      throw new Error("אין לך הרשאה להשלמת משלוח זה");
    }
    if (!currentDelivery.picked_up_at) {
      throw new Error("יש לאסוף את המשלוח מהמסעדה תחילה");
    }

    const { error } = await supabase
      .from("deliveries")
      .update({
        status: "completed" as const,
        completed_at: new Date().toISOString(),
        business_ready: false,
        business_confirmed: false,
      } as Record<string, unknown>)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error completing delivery:", error);
      throw new Error("שגיאה בהשלמת המשלוח");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery completed:", delivery.id);
    systemEvents.emitDeliveryCompleted(delivery);
    return delivery;
  },

  async courierUpdateLocation(payload: { courierId: string; latitude: number; longitude: number }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const courier = await this.getUserById(payload.courierId);
    assertRole(courier, "courier", "courierUpdateLocation");

    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("courier_profiles")
      .select("*")
      .eq("user_id", payload.courierId)
      .single();

    if (profileCheckError || !existingProfile) {
      console.log("[SUPABASE] Courier profile not found for location update", payload.courierId);
      throw new Error("פרופיל שליח לא נמצא");
    }

    const { error } = await supabase
      .from("courier_profiles")
      .update({
        current_latitude: payload.latitude,
        current_longitude: payload.longitude,
        location_updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("user_id", payload.courierId);

    if (error) {
      console.log("[SUPABASE] Error updating courier location:", error);
      throw new Error("שגיאה בעדכון המיקום");
    }

    const updated = await this.getUserById(payload.courierId);
    if (!updated) {
      throw new Error("שגיאה בטעינת המשתמש המעודכן");
    }

    console.log("[SUPABASE] Courier location updated:", payload.courierId, payload.latitude, payload.longitude);
    return updated;
  },

  async courierUpdateAvailability(payload: { courierId: string; isAvailable: boolean }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const courier = await this.getUserById(payload.courierId);
    assertRole(courier, "courier", "courierUpdateAvailability");

    // Check if courier profile exists in database
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("courier_profiles")
      .select("*")
      .eq("user_id", payload.courierId)
      .single();

    if (profileCheckError || !existingProfile) {
      console.log("[SUPABASE] Courier profile not found, creating one", payload.courierId, profileCheckError);
      // Create a default profile if it doesn't exist
      const { error: createError } = await supabase
        .from("courier_profiles")
        .insert({
          user_id: payload.courierId,
          age: 0,
          email: courier?.email || "",
          vehicle: "לא צוין",
          is_available: payload.isAvailable,
        } as Record<string, unknown>);

      if (createError) {
        console.log("[SUPABASE] Error creating courier profile:", createError);
        throw new Error("שגיאה ביצירת פרופיל שליח");
      }
      
      const updated = await this.getUserById(payload.courierId);
      if (!updated) {
        throw new Error("שגיאה בטעינת המשתמש המעודכן");
      }
      console.log("[SUPABASE] Courier profile created and availability set:", payload.courierId, payload.isAvailable);
      systemEvents.emitUserUpdated(updated);
      return updated;
    }

    const { error } = await supabase
      .from("courier_profiles")
      .update({
        is_available: payload.isAvailable,
      } as Record<string, unknown>)
      .eq("user_id", payload.courierId);

    if (error) {
      console.log("[SUPABASE] Error updating courier availability:", error);
      throw new Error("שגיאה בעדכון הזמינות");
    }

    const updated = await this.getUserById(payload.courierId);
    if (!updated) {
      throw new Error("שגיאה בטעינת המשתמש המעודכן");
    }

    console.log("[SUPABASE] Courier availability updated:", payload.courierId, payload.isAvailable);
    systemEvents.emitUserUpdated(updated);
    return updated;
  },

  async businessConfirmDelivery(payload: { businessId: string; deliveryId: string }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const business = await this.getUserById(payload.businessId);
    assertRole(business, "business", "businessConfirmDelivery");

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    if (currentDelivery.business_id !== payload.businessId) {
      throw new Error("אין לך הרשאה לאשר משלוח זה");
    }
    if (currentDelivery.status !== "taken") {
      throw new Error("ניתן לאשר רק משלוחים שנלקחו על ידי שליח");
    }
    if (!currentDelivery.courier_id) {
      throw new Error("לא ניתן לאשר משלוח ללא שליח משויך");
    }

    const updateData: Record<string, unknown> = {
      business_confirmed: true,
      confirmed_at: new Date().toISOString(),
    };

    if (!currentDelivery.estimated_arrival_minutes) {
      updateData.estimated_arrival_minutes = 15;
      console.log("[SUPABASE] Setting default ETA during business confirm: 15 minutes");
    }

    const { error } = await supabase
      .from("deliveries")
      .update(updateData)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error confirming delivery:", error);
      throw new Error("שגיאה באישור המשלוח");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery confirmed by business:", delivery.id);
    return delivery;
  },

  async businessMarkReady(payload: { businessId: string; deliveryId: string }): Promise<Delivery> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const business = await this.getUserById(payload.businessId);
    assertRole(business, "business", "businessMarkReady");

    const { data: current } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const currentDelivery = current as unknown as DbDelivery;
    if (currentDelivery.business_id !== payload.businessId) {
      throw new Error("אין לך הרשאה לסמן משלוח זה כמוכן");
    }
    if (currentDelivery.status !== "taken") {
      throw new Error("ניתן לסמן כמוכן רק משלוחים שנלקחו על ידי שליח");
    }
    if (!currentDelivery.business_confirmed) {
      throw new Error("יש לאשר את ההזמנה תחילה");
    }

    const { error } = await supabase
      .from("deliveries")
      .update({
        business_ready: true,
      } as Record<string, unknown>)
      .eq("id", payload.deliveryId);

    if (error) {
      console.log("[SUPABASE] Error marking delivery ready:", error);
      throw new Error("שגיאה בסימון המשלוח כמוכן");
    }

    const { data: updated } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", payload.deliveryId)
      .single();

    if (!updated) {
      throw new Error("שגיאה בטעינת המשלוח המעודכן");
    }

    const delivery = dbDeliveryToDelivery(updated as unknown as DbDelivery);
    console.log("[SUPABASE] Delivery marked ready:", delivery.id);
    systemEvents.emitDeliveryReady(delivery);
    return delivery;
  },

  async registerPushToken(userId: string, pushToken: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("משתמש לא נמצא");
    }

    const { error } = await supabase
      .from("users")
      .update({
        push_token: pushToken,
      } as Record<string, unknown>)
      .eq("id", userId);

    if (error) {
      console.log("[SUPABASE] Error registering push token:", error);
      throw new Error("שגיאה ברישום טוקן Push");
    }

    const updated = await this.getUserById(userId);
    if (!updated) {
      throw new Error("שגיאה בטעינת המשתמש המעודכן");
    }

    console.log("[SUPABASE] Push token registered for:", userId);
    return updated;
  },

  async getAvailableCouriersWithTokens(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        courier_profiles:courier_profiles!courier_profiles_user_id_fkey!inner(*)
      `)
      .eq("role", "courier")
      .not("push_token", "is", null);

    if (error) {
      console.log("[SUPABASE] Error fetching available couriers:", error);
      return [];
    }

    const users = (data || [])
      .map((dbUser: unknown) => dbUserToUser(dbUser as DbUser))
      .filter((user) => user.courierProfile?.isAvailable === true);

    return users;
  },

  async managerUpdateUser(payload: {
    managerId: string;
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
  }): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    console.log("[SUPABASE] Manager updating user:", payload.userId);

    const manager = await this.getUserById(payload.managerId);
    if (!manager || manager.role !== "manager") {
      throw new Error("גישה מותרת רק למנהלים מחוברים");
    }

    const targetUser = await this.getUserById(payload.userId);
    if (!targetUser) {
      throw new Error("המשתמש לא נמצא");
    }

    const userUpdates: Record<string, unknown> = {};
    if (payload.name !== undefined && payload.name.trim()) {
      userUpdates.name = payload.name.trim();
    }
    if (payload.phone !== undefined && payload.phone.trim()) {
      const normalizedPhone = payload.phone.trim().replace(/\D/g, "");
      if (normalizedPhone.length >= 9) {
        userUpdates.phone = payload.phone.trim();
      }
    }
    if (payload.email !== undefined && payload.email.trim()) {
      userUpdates.email = payload.email.trim().toLowerCase();
    }
    if (payload.password !== undefined && payload.password.trim().length >= 4) {
      userUpdates.password = payload.password.trim();
    }

    if (Object.keys(userUpdates).length > 0) {
      const { error: userError } = await supabase
        .from("users")
        .update(userUpdates)
        .eq("id", payload.userId);

      if (userError) {
        console.log("[SUPABASE] Error updating user:", userError);
        throw new Error("שגיאה בעדכון פרטי המשתמש");
      }
    }

    if (targetUser.role === "courier" && payload.courierProfile) {
      const profileUpdates: Record<string, unknown> = {};
      if (payload.courierProfile.age !== undefined) {
        profileUpdates.age = payload.courierProfile.age;
      }
      if (payload.courierProfile.vehicle !== undefined && payload.courierProfile.vehicle.trim()) {
        profileUpdates.vehicle = payload.courierProfile.vehicle.trim();
      }
      if (payload.courierProfile.email !== undefined && payload.courierProfile.email.trim()) {
        profileUpdates.email = payload.courierProfile.email.trim().toLowerCase();
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("courier_profiles")
          .update(profileUpdates)
          .eq("user_id", payload.userId);

        if (profileError) {
          console.log("[SUPABASE] Error updating courier profile:", profileError);
          throw new Error("שגיאה בעדכון פרופיל השליח");
        }
      }
    }

    if (targetUser.role === "business" && payload.businessProfile) {
      const profileUpdates: Record<string, unknown> = {};
      if (payload.businessProfile.address !== undefined && payload.businessProfile.address.trim()) {
        profileUpdates.address = payload.businessProfile.address.trim();
      }
      if (payload.businessProfile.email !== undefined && payload.businessProfile.email.trim()) {
        profileUpdates.email = payload.businessProfile.email.trim().toLowerCase();
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("business_profiles")
          .update(profileUpdates)
          .eq("user_id", payload.userId);

        if (profileError) {
          console.log("[SUPABASE] Error updating business profile:", profileError);
          throw new Error("שגיאה בעדכון פרופיל העסק");
        }
      }
    }

    const updated = await this.getUserById(payload.userId);
    if (!updated) {
      throw new Error("שגיאה בטעינת המשתמש המעודכן");
    }

    console.log("[SUPABASE] User updated successfully:", payload.userId);
    systemEvents.emitUserUpdated(updated);
    return updated;
  },

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    if (!isSupabaseConfigured()) {
      console.log("[SUPABASE] Not configured, returning null for customer lookup");
      return null;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      console.log("[SUPABASE] Invalid phone for customer lookup");
      return null;
    }

    console.log("[SUPABASE] Looking up customer by phone:", normalizedPhone);

    const comparisonKey = createPhoneComparisonKey(normalizedPhone);

    const { data, error } = await supabase
      .from("customers")
      .select("*");

    if (error) {
      console.log("[SUPABASE] Error fetching customers:", error);
      return null;
    }

    const foundCustomer = (data || []).find((candidate: unknown) => {
      const c = candidate as DbCustomer;
      const candidateNormalized = normalizePhoneNumber(c.phone);
      const candidateKey = createPhoneComparisonKey(candidateNormalized || c.phone);
      return (
        (!!candidateNormalized && candidateNormalized === normalizedPhone) ||
        (!!candidateKey && !!comparisonKey && candidateKey === comparisonKey)
      );
    });

    if (!foundCustomer) {
      console.log("[SUPABASE] Customer not found for phone:", normalizedPhone);
      return null;
    }

    const customer = dbCustomerToCustomer(foundCustomer as DbCustomer);
    console.log("[SUPABASE] Customer found:", customer.id, customer.name);
    return customer;
  },

  async saveCustomer(payload: {
    phone: string;
    name: string;
    address?: string;
    city?: string;
    floor?: string;
    notes?: string;
    businessId?: string;
  }): Promise<Customer> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!normalizedPhone || !isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }

    if (!payload.name.trim()) {
      throw new Error("יש להזין שם לקוח");
    }

    console.log("[SUPABASE] Saving customer:", normalizedPhone, payload.name);

    const existingCustomer = await this.getCustomerByPhone(normalizedPhone);

    if (existingCustomer) {
      const updateData: Record<string, unknown> = {
        name: payload.name.trim(),
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        floor: payload.floor?.trim() || null,
        notes: payload.notes?.trim() || null,
        business_id: payload.businessId || null,
      };

      console.log("[SUPABASE] Updating customer with latest order details:", existingCustomer.id, updateData);

      const { error: updateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", existingCustomer.id);

      if (updateError) {
        console.log("[SUPABASE] Error updating customer:", updateError);
        throw new Error("שגיאה בעדכון פרטי הלקוח");
      }

      const { data: updatedData, error: fetchError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", existingCustomer.id)
        .single();

      if (fetchError || !updatedData) {
        throw new Error("שגיאה בטעינת פרטי הלקוח המעודכנים");
      }

      const updated = dbCustomerToCustomer(updatedData as DbCustomer);
      console.log("[SUPABASE] Customer updated:", updated.id);
      return updated;
    }

    const customerId = `customer-${generateId()}`;

    const { error: insertError } = await supabase.from("customers").insert({
      id: customerId,
      phone: normalizedPhone,
      name: payload.name.trim(),
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      floor: payload.floor?.trim() || null,
      notes: payload.notes?.trim() || null,
      business_id: payload.businessId || null,
    } as Record<string, unknown>);

    if (insertError) {
      console.log("[SUPABASE] Error creating customer:", insertError);
      throw new Error("שגיאה בשמירת פרטי הלקוח");
    }

    const { data: createdData, error: fetchError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (fetchError || !createdData) {
      throw new Error("שגיאה בטעינת פרטי הלקוח שנשמרו");
    }

    const created = dbCustomerToCustomer(createdData as DbCustomer);
    console.log("[SUPABASE] Customer created:", created.id);
    return created;
  },
};
