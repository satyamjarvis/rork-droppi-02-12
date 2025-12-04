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
