export type UserRole = "business" | "courier" | "manager";

export type CourierLocation = {
  latitude: number;
  longitude: number;
  updatedAt: string;
};

export type CourierProfile = {
  age: number;
  email: string;
  vehicle: string;
  isAvailable?: boolean;
  idNumber?: string;
  currentLocation?: CourierLocation;
};

export type BusinessProfile = {
  address: string;
  email: string;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: UserRole;
  courierProfile?: CourierProfile;
  businessProfile?: BusinessProfile;
  email?: string;
  pushToken?: string;
};

export type DeliveryStatus = "waiting" | "taken" | "completed";

export type Customer = {
  id: string;
  phone: string;
  name: string;
  address?: string;
  city?: string;
  floor?: string;
  notes?: string;
  businessId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Delivery = {
  id: string;
  businessId: string;
  courierId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  notes: string;
  status: DeliveryStatus;
  createdAt: string;
  preparationTimeMinutes?: number;
  estimatedArrivalMinutes?: number;
  businessConfirmed?: boolean;
  confirmedAt?: string;
  businessReady?: boolean;
  pickedUpAt?: string;
  completedAt?: string;
  customerName: string;
  customerPhone: string;
  payment?: number;
  distanceKm?: number;
};
