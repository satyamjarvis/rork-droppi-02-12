import { supabase } from "./supabase";
import { Tables, UpdateTables } from "../types/supabase";
import { Delivery, User, UserRole, DeliveryStatus } from "../types/models";

console.log("[DATABASE] Database service initialized");

type CreateDeliveryInput = {
  businessId: string;
  pickupAddress: string;
  dropoffAddress: string;
  notes: string;
  customerName: string;
  customerPhone: string;
  preparationTimeMinutes: number;
};

type TakeDeliveryInput = {
  courierId: string;
  deliveryId: string;
  estimatedArrivalMinutes: number;
};

type PickupDeliveryInput = {
  courierId: string;
  deliveryId: string;
};

type CompleteDeliveryInput = {
  courierId: string;
  deliveryId: string;
};

type ConfirmDeliveryInput = {
  businessId: string;
  deliveryId: string;
};

type MarkReadyInput = {
  businessId: string;
  deliveryId: string;
};

type UpdateAvailabilityInput = {
  courierId: string;
  isAvailable: boolean;
};

type LoginInput = {
  phone: string;
  password: string;
};

type RegisterCourierInput = {
  name: string;
  age: number;
  phone: string;
  email: string;
  vehicle: string;
  password: string;
  managerId: string;
};

type RegisterBusinessInput = {
  name: string;
  address: string;
  phone: string;
  email: string;
  password: string;
  managerId: string;
};

type RegisterManagerInput = {
  name: string;
  phone: string;
  email: string;
  password: string;
  managerId: string;
};

type UpdateUserInput = {
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
  managerId: string;
};

type UpdateDeliveryInput = {
  deliveryId: string;
  status?: DeliveryStatus;
  courierId?: string | null;
  managerId: string;
};

const transformDbUserToUser = (
  dbUser: Tables<"users">,
  courierProfile?: Tables<"courier_profiles"> | null,
  businessProfile?: Tables<"business_profiles"> | null
): User => {
  const user: User = {
    id: dbUser.id,
    name: dbUser.name,
    phone: dbUser.phone,
    password: dbUser.password,
    role: dbUser.role,
    email: dbUser.email ?? undefined,
    pushToken: dbUser.push_token ?? undefined,
  };

  if (courierProfile && dbUser.role === "courier") {
    user.courierProfile = {
      age: courierProfile.age,
      email: courierProfile.email,
      vehicle: courierProfile.vehicle,
      isAvailable: courierProfile.is_available,
    };
  }

  if (businessProfile && dbUser.role === "business") {
    user.businessProfile = {
      address: businessProfile.address,
      email: businessProfile.email,
    };
  }

  return user;
};

const transformDbDeliveryToDelivery = (dbDelivery: Tables<"deliveries">): Delivery => {
  return {
    id: dbDelivery.id,
    businessId: dbDelivery.business_id,
    courierId: dbDelivery.courier_id,
    pickupAddress: dbDelivery.pickup_address,
    dropoffAddress: dbDelivery.dropoff_address,
    notes: dbDelivery.notes,
    status: dbDelivery.status,
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
};

export const database = {
  auth: {
    async login(input: LoginInput): Promise<User> {
      console.log("[DATABASE] Login attempt for phone:", input.phone);
      
      const { data: users, error } = await supabase
        .from("users")
        .select(`
          *,
          courier_profiles(*),
          business_profiles(*)
        `)
        .eq("phone", input.phone);

      if (error) {
        console.error("[DATABASE] Login query error:", error);
        throw new Error("שגיאה בהתחברות למסד הנתונים");
      }

      if (!users || users.length === 0) {
        console.log("[DATABASE] User not found");
        throw new Error("פרטי הכניסה שגויים");
      }

      const user = users[0];
      
      if (user.password !== input.password) {
        console.log("[DATABASE] Invalid password");
        throw new Error("פרטי הכניסה שגויים");
      }

      console.log("[DATABASE] Login successful:", user.id);
      
      const courierProfile = user.courier_profiles?.[0] || null;
      const businessProfile = user.business_profiles?.[0] || null;
      
      return transformDbUserToUser(user, courierProfile, businessProfile);
    },
  },

  users: {
    async list(): Promise<User[]> {
      console.log("[DATABASE] Fetching all users");
      
      const { data: users, error } = await supabase
        .from("users")
        .select(`
          *,
          courier_profiles(*),
          business_profiles(*)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[DATABASE] Users list error:", error);
        throw new Error("שגיאה בטעינת משתמשים");
      }

      console.log("[DATABASE] Users fetched:", users?.length || 0);
      
      return (users || []).map((user) => {
        const courierProfile = user.courier_profiles?.[0] || null;
        const businessProfile = user.business_profiles?.[0] || null;
        return transformDbUserToUser(user, courierProfile, businessProfile);
      });
    },

    async registerCourier(input: RegisterCourierInput): Promise<User> {
      console.log("[DATABASE] Registering courier:", input.phone);

      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", input.phone);

      if (checkError) {
        console.error("[DATABASE] Check existing user error:", checkError);
        throw new Error("שגיאה בבדיקת משתמש קיים");
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error("מספר טלפון זה כבר רשום במערכת");
      }

      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: input.name,
          phone: input.phone,
          password: input.password,
          role: "courier" as UserRole,
          email: input.email,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("[DATABASE] Create courier user error:", userError);
        throw new Error("שגיאה ביצירת משתמש שליח");
      }

      const { data: courierProfile, error: profileError } = await supabase
        .from("courier_profiles")
        .insert({
          user_id: newUser.id,
          age: input.age,
          email: input.email,
          vehicle: input.vehicle,
          is_available: false,
        })
        .select()
        .single();

      if (profileError) {
        console.error("[DATABASE] Create courier profile error:", profileError);
        throw new Error("שגיאה ביצירת פרופיל שליח");
      }

      console.log("[DATABASE] Courier registered successfully:", newUser.id);
      return transformDbUserToUser(newUser, courierProfile, null);
    },

    async registerBusiness(input: RegisterBusinessInput): Promise<User> {
      console.log("[DATABASE] Registering business:", input.phone);

      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", input.phone);

      if (checkError) {
        console.error("[DATABASE] Check existing user error:", checkError);
        throw new Error("שגיאה בבדיקת משתמש קיים");
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error("מספר טלפון זה כבר רשום במערכת");
      }

      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: input.name,
          phone: input.phone,
          password: input.password,
          role: "business" as UserRole,
          email: input.email,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("[DATABASE] Create business user error:", userError);
        throw new Error("שגיאה ביצירת משתמש עסק");
      }

      const { data: businessProfile, error: profileError } = await supabase
        .from("business_profiles")
        .insert({
          user_id: newUser.id,
          address: input.address,
          email: input.email,
        })
        .select()
        .single();

      if (profileError) {
        console.error("[DATABASE] Create business profile error:", profileError);
        throw new Error("שגיאה ביצירת פרופיל עסק");
      }

      console.log("[DATABASE] Business registered successfully:", newUser.id);
      return transformDbUserToUser(newUser, null, businessProfile);
    },

    async registerManager(input: RegisterManagerInput): Promise<User> {
      console.log("[DATABASE] Registering manager:", input.phone);

      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", input.phone);

      if (checkError) {
        console.error("[DATABASE] Check existing user error:", checkError);
        throw new Error("שגיאה בבדיקת משתמש קיים");
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error("מספר טלפון זה כבר רשום במערכת");
      }

      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: input.name,
          phone: input.phone,
          password: input.password,
          role: "manager" as UserRole,
          email: input.email,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("[DATABASE] Create manager user error:", userError);
        throw new Error("שגיאה ביצירת משתמש מנהל");
      }

      console.log("[DATABASE] Manager registered successfully:", newUser.id);
      return transformDbUserToUser(newUser, null, null);
    },

    async updateUser(input: UpdateUserInput): Promise<User> {
      console.log("[DATABASE] Updating user:", input.userId);

      const updates: UpdateTables<"users"> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.phone !== undefined) updates.phone = input.phone;
      if (input.email !== undefined) updates.email = input.email;
      if (input.password !== undefined) updates.password = input.password;

      if (Object.keys(updates).length > 0) {
        const { error: userError } = await supabase
          .from("users")
          .update(updates)
          .eq("id", input.userId);

        if (userError) {
          console.error("[DATABASE] Update user error:", userError);
          throw new Error("שגיאה בעדכון משתמש");
        }
      }

      if (input.courierProfile) {
        const courierUpdates: UpdateTables<"courier_profiles"> = {};
        if (input.courierProfile.age !== undefined) courierUpdates.age = input.courierProfile.age;
        if (input.courierProfile.vehicle !== undefined) courierUpdates.vehicle = input.courierProfile.vehicle;
        if (input.courierProfile.email !== undefined) courierUpdates.email = input.courierProfile.email;

        if (Object.keys(courierUpdates).length > 0) {
          const { error: courierError } = await supabase
            .from("courier_profiles")
            .update(courierUpdates)
            .eq("user_id", input.userId);

          if (courierError) {
            console.error("[DATABASE] Update courier profile error:", courierError);
            throw new Error("שגיאה בעדכון פרופיל שליח");
          }
        }
      }

      if (input.businessProfile) {
        const businessUpdates: UpdateTables<"business_profiles"> = {};
        if (input.businessProfile.address !== undefined) businessUpdates.address = input.businessProfile.address;
        if (input.businessProfile.email !== undefined) businessUpdates.email = input.businessProfile.email;

        if (Object.keys(businessUpdates).length > 0) {
          const { error: businessError } = await supabase
            .from("business_profiles")
            .update(businessUpdates)
            .eq("user_id", input.userId);

          if (businessError) {
            console.error("[DATABASE] Update business profile error:", businessError);
            throw new Error("שגיאה בעדכון פרופיל עסק");
          }
        }
      }

      const { data: updatedUser, error: fetchError } = await supabase
        .from("users")
        .select(`
          *,
          courier_profiles(*),
          business_profiles(*)
        `)
        .eq("id", input.userId)
        .single();

      if (fetchError || !updatedUser) {
        console.error("[DATABASE] Fetch updated user error:", fetchError);
        throw new Error("שגיאה בטעינת משתמש מעודכן");
      }

      console.log("[DATABASE] User updated successfully:", updatedUser.id);
      const courierProfile = updatedUser.courier_profiles?.[0] || null;
      const businessProfile = updatedUser.business_profiles?.[0] || null;
      return transformDbUserToUser(updatedUser, courierProfile, businessProfile);
    },
  },

  deliveries: {
    async list(): Promise<Delivery[]> {
      console.log("[DATABASE] Fetching all deliveries");
      
      const { data: deliveries, error } = await supabase
        .from("deliveries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[DATABASE] Deliveries list error:", error);
        throw new Error("שגיאה בטעינת משלוחים");
      }

      console.log("[DATABASE] Deliveries fetched:", deliveries?.length || 0);
      return (deliveries || []).map(transformDbDeliveryToDelivery);
    },

    async create(input: CreateDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Creating delivery for business:", input.businessId);

      const { data: newDelivery, error } = await supabase
        .from("deliveries")
        .insert({
          business_id: input.businessId,
          pickup_address: input.pickupAddress,
          dropoff_address: input.dropoffAddress,
          notes: input.notes,
          customer_name: input.customerName,
          customer_phone: input.customerPhone,
          preparation_time_minutes: input.preparationTimeMinutes,
          status: "waiting" as DeliveryStatus,
          business_confirmed: false,
          business_ready: false,
        })
        .select()
        .single();

      if (error || !newDelivery) {
        console.error("[DATABASE] Create delivery error:", error);
        throw new Error("שגיאה ביצירת משלוח");
      }

      console.log("[DATABASE] Delivery created successfully:", newDelivery.id);
      return transformDbDeliveryToDelivery(newDelivery);
    },

    async take(input: TakeDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Courier taking delivery:", input.deliveryId);

      const { data: existingDelivery, error: fetchError } = await supabase
        .from("deliveries")
        .select("*")
        .eq("id", input.deliveryId)
        .single();

      if (fetchError || !existingDelivery) {
        console.error("[DATABASE] Fetch delivery error:", fetchError);
        throw new Error("המשלוח לא נמצא");
      }

      if (existingDelivery.status !== "waiting") {
        if (existingDelivery.courier_id === input.courierId) {
          console.log("[DATABASE] Courier already owns this delivery, returning existing");
          return transformDbDeliveryToDelivery(existingDelivery);
        }
        throw new Error("המשלוח כבר נלקח על ידי שליח אחר");
      }

      const { data: updatedDelivery, error: updateError } = await supabase
        .from("deliveries")
        .update({
          courier_id: input.courierId,
          status: "taken" as DeliveryStatus,
          estimated_arrival_minutes: input.estimatedArrivalMinutes,
        })
        .eq("id", input.deliveryId)
        .select()
        .single();

      if (updateError || !updatedDelivery) {
        console.error("[DATABASE] Take delivery error:", updateError);
        throw new Error("שגיאה בלקיחת משלוח");
      }

      console.log("[DATABASE] Delivery taken successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },

    async pickup(input: PickupDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Courier picking up delivery:", input.deliveryId);

      const { data: updatedDelivery, error } = await supabase
        .from("deliveries")
        .update({
          picked_up_at: new Date().toISOString(),
        })
        .eq("id", input.deliveryId)
        .eq("courier_id", input.courierId)
        .select()
        .single();

      if (error || !updatedDelivery) {
        console.error("[DATABASE] Pickup delivery error:", error);
        throw new Error("שגיאה באיסוף משלוח");
      }

      console.log("[DATABASE] Delivery picked up successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },

    async complete(input: CompleteDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Courier completing delivery:", input.deliveryId);

      const { data: updatedDelivery, error } = await supabase
        .from("deliveries")
        .update({
          status: "completed" as DeliveryStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", input.deliveryId)
        .eq("courier_id", input.courierId)
        .select()
        .single();

      if (error || !updatedDelivery) {
        console.error("[DATABASE] Complete delivery error:", error);
        throw new Error("שגיאה בהשלמת משלוח");
      }

      console.log("[DATABASE] Delivery completed successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },

    async confirm(input: ConfirmDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Business confirming delivery:", input.deliveryId);

      const { data: updatedDelivery, error } = await supabase
        .from("deliveries")
        .update({
          business_confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", input.deliveryId)
        .eq("business_id", input.businessId)
        .select()
        .single();

      if (error || !updatedDelivery) {
        console.error("[DATABASE] Confirm delivery error:", error);
        throw new Error("שגיאה באישור משלוח");
      }

      console.log("[DATABASE] Delivery confirmed successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },

    async markReady(input: MarkReadyInput): Promise<Delivery> {
      console.log("[DATABASE] Business marking delivery ready:", input.deliveryId);

      const { data: updatedDelivery, error } = await supabase
        .from("deliveries")
        .update({
          business_ready: true,
        })
        .eq("id", input.deliveryId)
        .eq("business_id", input.businessId)
        .select()
        .single();

      if (error || !updatedDelivery) {
        console.error("[DATABASE] Mark ready error:", error);
        throw new Error("שגיאה בסימון משלוח כמוכן");
      }

      console.log("[DATABASE] Delivery marked ready successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },

    async update(input: UpdateDeliveryInput): Promise<Delivery> {
      console.log("[DATABASE] Manager updating delivery:", input.deliveryId);

      const updates: UpdateTables<"deliveries"> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.courierId !== undefined) updates.courier_id = input.courierId;

      const { data: updatedDelivery, error } = await supabase
        .from("deliveries")
        .update(updates)
        .eq("id", input.deliveryId)
        .select()
        .single();

      if (error || !updatedDelivery) {
        console.error("[DATABASE] Update delivery error:", error);
        throw new Error("שגיאה בעדכון משלוח");
      }

      console.log("[DATABASE] Delivery updated successfully:", updatedDelivery.id);
      return transformDbDeliveryToDelivery(updatedDelivery);
    },
  },

  courier: {
    async updateAvailability(input: UpdateAvailabilityInput): Promise<User> {
      console.log("[DATABASE] Updating courier availability:", input.courierId, input.isAvailable);

      const { error: updateError } = await supabase
        .from("courier_profiles")
        .update({
          is_available: input.isAvailable,
        })
        .eq("user_id", input.courierId);

      if (updateError) {
        console.error("[DATABASE] Update availability error:", updateError);
        throw new Error("שגיאה בעדכון זמינות");
      }

      const { data: updatedUser, error: fetchError } = await supabase
        .from("users")
        .select(`
          *,
          courier_profiles(*),
          business_profiles(*)
        `)
        .eq("id", input.courierId)
        .single();

      if (fetchError || !updatedUser) {
        console.error("[DATABASE] Fetch updated user error:", fetchError);
        throw new Error("שגיאה בטעינת משתמש מעודכן");
      }

      console.log("[DATABASE] Availability updated successfully");
      const courierProfile = updatedUser.courier_profiles?.[0] || null;
      return transformDbUserToUser(updatedUser, courierProfile, null);
    },
  },
};
