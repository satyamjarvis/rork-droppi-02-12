import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Delivery, DeliveryStatus, User, UserRole } from "@/types/models";

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

export async function getUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) {
    console.log("[SUPABASE] Not configured, returning empty users");
    return [];
  }

  console.log("[SUPABASE] Fetching users");

  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("[SUPABASE] Error fetching users:", error);
    return [];
  }

  return (data || []).map((row) => dbUserToUser(row as unknown as DbUser));
}

export async function getDeliveries(): Promise<Delivery[]> {
  if (!isSupabaseConfigured()) {
    console.log("[SUPABASE] Not configured, returning empty deliveries");
    return [];
  }

  console.log("[SUPABASE] Fetching deliveries");

  const { data, error} = await supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("[SUPABASE] Error fetching deliveries:", error);
    return [];
  }

  return (data || []).map((row) => dbDeliveryToDelivery(row as DbDelivery));
}

export async function login(phone: string, password: string): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Login attempt for phone:", phone);

  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .eq("phone", phone)
    .eq("password", password)
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Login failed:", error);
    throw new Error("מספר טלפון או סיסמה שגויים");
  }

  return dbUserToUser(data as unknown as DbUser);
}

export async function createDelivery(params: {
  businessId: string;
  pickupAddress: string;
  dropoffAddress: string;
  notes: string;
  customerName: string;
  customerPhone: string;
  preparationTimeMinutes: number;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Creating delivery");

  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      business_id: params.businessId,
      pickup_address: params.pickupAddress,
      dropoff_address: params.dropoffAddress,
      notes: params.notes,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      preparation_time_minutes: params.preparationTimeMinutes,
      status: "pending",
      business_confirmed: false,
      business_ready: false,
    })
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Create delivery failed:", error);
    throw new Error("יצירת המשלוח נכשלה");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function takeDelivery(params: {
  courierId: string;
  deliveryId: string;
  estimatedArrivalMinutes: number;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Taking delivery", params.deliveryId);

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      courier_id: params.courierId,
      status: "assigned",
      estimated_arrival_minutes: params.estimatedArrivalMinutes,
    })
    .eq("id", params.deliveryId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Take delivery failed:", error);
    throw new Error("לא ניתן לקחת את המשלוח");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function pickupDelivery(params: {
  courierId: string;
  deliveryId: string;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Picking up delivery", params.deliveryId);

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
    })
    .eq("id", params.deliveryId)
    .eq("courier_id", params.courierId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Pickup delivery failed:", error);
    throw new Error("לא ניתן לאסוף את המשלוח");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function completeDelivery(params: {
  courierId: string;
  deliveryId: string;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Completing delivery", params.deliveryId);

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      status: "delivered",
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.deliveryId)
    .eq("courier_id", params.courierId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Complete delivery failed:", error);
    throw new Error("לא ניתן להשלים את המשלוח");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function confirmDelivery(params: {
  businessId: string;
  deliveryId: string;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Confirming delivery", params.deliveryId);

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      business_confirmed: true,
      confirmed_at: new Date().toISOString(),
      status: "confirmed",
    })
    .eq("id", params.deliveryId)
    .eq("business_id", params.businessId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Confirm delivery failed:", error);
    throw new Error("לא ניתן לאשר את המשלוח");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function markReady(params: {
  businessId: string;
  deliveryId: string;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Marking delivery ready", params.deliveryId);

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      business_ready: true,
      status: "waiting",
    })
    .eq("id", params.deliveryId)
    .eq("business_id", params.businessId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Mark ready failed:", error);
    throw new Error("לא ניתן לסמן את המשלוח כמוכן");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function updateAvailability(params: {
  courierId: string;
  isAvailable: boolean;
}): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Updating courier availability", params.courierId, params.isAvailable);

  const { error } = await supabase
    .from("courier_profiles")
    .update({
      is_available: params.isAvailable,
    })
    .eq("user_id", params.courierId);

  if (error) {
    console.log("[SUPABASE] Update availability failed:", error);
    throw new Error("עדכון הזמינות נכשל");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .eq("id", params.courierId)
    .single();

  if (userError || !userData) {
    console.log("[SUPABASE] Fetch updated user failed:", userError);
    throw new Error("עדכון הזמינות נכשל");
  }

  return dbUserToUser(userData as unknown as DbUser);
}

export async function managerUpdateDelivery(params: {
  managerId: string;
  deliveryId: string;
  status?: DeliveryStatus;
  courierId?: string | null;
}): Promise<Delivery> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Manager updating delivery", params.deliveryId);

  const updateData: Partial<{
    status: string;
    courier_id: string | null;
  }> = {};

  if (params.status !== undefined) {
    updateData.status = params.status;
  }
  if (params.courierId !== undefined) {
    updateData.courier_id = params.courierId;
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update(updateData)
    .eq("id", params.deliveryId)
    .select()
    .single();

  if (error || !data) {
    console.log("[SUPABASE] Manager update delivery failed:", error);
    throw new Error("עדכון המשלוח נכשל");
  }

  return dbDeliveryToDelivery(data as DbDelivery);
}

export async function managerRegisterCourier(params: {
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
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Manager registering courier", params.phone);

  const { data: userData, error: userError } = await supabase
    .from("users")
    .insert({
      name: params.name,
      phone: params.phone,
      password: params.password,
      role: "courier",
      email: params.email,
    })
    .select()
    .single();

  if (userError || !userData) {
    console.log("[SUPABASE] Create courier user failed:", userError);
    throw new Error("יצירת השליח נכשלה");
  }

  const { error: profileError } = await supabase
    .from("courier_profiles")
    .insert({
      user_id: userData.id,
      age: params.age,
      email: params.email,
      vehicle: params.vehicle,
      is_available: false,
      id_number: params.idNumber ?? null,
    });

  if (profileError) {
    console.log("[SUPABASE] Create courier profile failed:", profileError);
    await supabase.from("users").delete().eq("id", userData.id);
    throw new Error("יצירת השליח נכשלה");
  }

  const { data: fullUser, error: fetchError } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .eq("id", userData.id)
    .single();

  if (fetchError || !fullUser) {
    console.log("[SUPABASE] Fetch new courier failed:", fetchError);
    throw new Error("יצירת השליח נכשלה");
  }

  return dbUserToUser(fullUser as unknown as DbUser);
}

export async function managerRegisterBusiness(params: {
  managerId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  password: string;
}): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Manager registering business", params.phone);

  const { data: userData, error: userError } = await supabase
    .from("users")
    .insert({
      name: params.name,
      phone: params.phone,
      password: params.password,
      role: "business",
      email: params.email,
    })
    .select()
    .single();

  if (userError || !userData) {
    console.log("[SUPABASE] Create business user failed:", userError);
    throw new Error("יצירת העסק נכשלה");
  }

  const { error: profileError } = await supabase
    .from("business_profiles")
    .insert({
      user_id: userData.id,
      address: params.address,
      email: params.email,
    });

  if (profileError) {
    console.log("[SUPABASE] Create business profile failed:", profileError);
    await supabase.from("users").delete().eq("id", userData.id);
    throw new Error("יצירת העסק נכשלה");
  }

  const { data: fullUser, error: fetchError } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .eq("id", userData.id)
    .single();

  if (fetchError || !fullUser) {
    console.log("[SUPABASE] Fetch new business failed:", fetchError);
    throw new Error("יצירת העסק נכשלה");
  }

  return dbUserToUser(fullUser as unknown as DbUser);
}

export async function managerRegisterManager(params: {
  managerId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Manager registering manager", params.phone);

  const { data: userData, error: userError } = await supabase
    .from("users")
    .insert({
      name: params.name,
      phone: params.phone,
      password: params.password,
      role: "manager",
      email: params.email,
    })
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .single();

  if (userError || !userData) {
    console.log("[SUPABASE] Create manager user failed:", userError);
    throw new Error("יצירת המנהל נכשלה");
  }

  return dbUserToUser(userData as unknown as DbUser);
}

export async function managerUpdateUser(params: {
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
    throw new Error("Supabase not configured");
  }

  console.log("[SUPABASE] Manager updating user", params.userId);

  const updateData: Partial<{
    name: string;
    phone: string;
    email: string;
    password: string;
  }> = {};

  if (params.name !== undefined) updateData.name = params.name;
  if (params.phone !== undefined) updateData.phone = params.phone;
  if (params.email !== undefined) updateData.email = params.email;
  if (params.password !== undefined) updateData.password = params.password;

  if (Object.keys(updateData).length > 0) {
    const { error: userError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", params.userId);

    if (userError) {
      console.log("[SUPABASE] Update user failed:", userError);
      throw new Error("עדכון המשתמש נכשל");
    }
  }

  if (params.courierProfile) {
    const courierUpdateData: Partial<{
      age: number;
      vehicle: string;
      email: string;
    }> = {};

    if (params.courierProfile.age !== undefined) courierUpdateData.age = params.courierProfile.age;
    if (params.courierProfile.vehicle !== undefined) courierUpdateData.vehicle = params.courierProfile.vehicle;
    if (params.courierProfile.email !== undefined) courierUpdateData.email = params.courierProfile.email;

    if (Object.keys(courierUpdateData).length > 0) {
      const { error: profileError } = await supabase
        .from("courier_profiles")
        .update(courierUpdateData)
        .eq("user_id", params.userId);

      if (profileError) {
        console.log("[SUPABASE] Update courier profile failed:", profileError);
        throw new Error("עדכון פרופיל השליח נכשל");
      }
    }
  }

  if (params.businessProfile) {
    const businessUpdateData: Partial<{
      address: string;
      email: string;
    }> = {};

    if (params.businessProfile.address !== undefined) businessUpdateData.address = params.businessProfile.address;
    if (params.businessProfile.email !== undefined) businessUpdateData.email = params.businessProfile.email;

    if (Object.keys(businessUpdateData).length > 0) {
      const { error: profileError } = await supabase
        .from("business_profiles")
        .update(businessUpdateData)
        .eq("user_id", params.userId);

      if (profileError) {
        console.log("[SUPABASE] Update business profile failed:", profileError);
        throw new Error("עדכון פרופיל העסק נכשל");
      }
    }
  }

  const { data: fullUser, error: fetchError } = await supabase
    .from("users")
    .select(`
      *,
      courier_profiles(*),
      business_profiles(*)
    `)
    .eq("id", params.userId)
    .single();

  if (fetchError || !fullUser) {
    console.log("[SUPABASE] Fetch updated user failed:", fetchError);
    throw new Error("עדכון המשתמש נכשל");
  }

  return dbUserToUser(fullUser as unknown as DbUser);
}
