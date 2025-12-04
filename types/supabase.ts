export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "business" | "courier" | "manager";
export type DeliveryStatus = "waiting" | "taken" | "completed";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          phone: string;
          password: string;
          role: UserRole;
          email: string | null;
          push_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          password: string;
          role: UserRole;
          email?: string | null;
          push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          password?: string;
          role?: UserRole;
          email?: string | null;
          push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      courier_profiles: {
        Row: {
          id: string;
          user_id: string;
          age: number;
          email: string;
          vehicle: string;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age: number;
          email: string;
          vehicle: string;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          age?: number;
          email?: string;
          vehicle?: string;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_profiles: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          address?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          business_id: string;
          courier_id: string | null;
          pickup_address: string;
          dropoff_address: string;
          notes: string;
          status: DeliveryStatus;
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
        Insert: {
          id?: string;
          business_id: string;
          courier_id?: string | null;
          pickup_address: string;
          dropoff_address: string;
          notes?: string;
          status?: DeliveryStatus;
          created_at?: string;
          updated_at?: string;
          preparation_time_minutes?: number | null;
          estimated_arrival_minutes?: number | null;
          business_confirmed?: boolean;
          confirmed_at?: string | null;
          business_ready?: boolean;
          picked_up_at?: string | null;
          completed_at?: string | null;
          customer_name: string;
          customer_phone: string;
          payment?: number | null;
          distance_km?: number | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          courier_id?: string | null;
          pickup_address?: string;
          dropoff_address?: string;
          notes?: string;
          status?: DeliveryStatus;
          created_at?: string;
          updated_at?: string;
          preparation_time_minutes?: number | null;
          estimated_arrival_minutes?: number | null;
          business_confirmed?: boolean;
          confirmed_at?: string | null;
          business_ready?: boolean;
          picked_up_at?: string | null;
          completed_at?: string | null;
          customer_name?: string;
          customer_phone?: string;
          payment?: number | null;
          distance_km?: number | null;
        };
      };
      customers: {
        Row: {
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
        Insert: {
          id?: string;
          phone: string;
          name: string;
          address?: string | null;
          city?: string | null;
          floor?: string | null;
          notes?: string | null;
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          name?: string;
          address?: string | null;
          city?: string | null;
          floor?: string | null;
          notes?: string | null;
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      delivery_status: DeliveryStatus;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
