import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function useSupabaseRealtime() {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const invalidateQueries = useCallback(() => {
    console.log("[REALTIME] Invalidating queries due to database change");
    queryClient.invalidateQueries({ queryKey: ["users"] }).catch((err: unknown) => {
      console.log("[REALTIME] Failed to invalidate users", err);
    });
    queryClient.invalidateQueries({ queryKey: ["deliveries"] }).catch((err: unknown) => {
      console.log("[REALTIME] Failed to invalidate deliveries", err);
    });
  }, [queryClient]);

  const handleUsersChange = useCallback(
    (payload: RealtimePayload) => {
      console.log("[REALTIME] Users table changed:", payload.eventType);
      invalidateQueries();
    },
    [invalidateQueries]
  );

  const handleDeliveriesChange = useCallback(
    (payload: RealtimePayload) => {
      console.log("[REALTIME] Deliveries table changed:", payload.eventType);
      invalidateQueries();
    },
    [invalidateQueries]
  );

  const handleCourierProfilesChange = useCallback(
    (payload: RealtimePayload) => {
      console.log("[REALTIME] Courier profiles changed:", payload.eventType);
      invalidateQueries();
    },
    [invalidateQueries]
  );

  const handleBusinessProfilesChange = useCallback(
    (payload: RealtimePayload) => {
      console.log("[REALTIME] Business profiles changed:", payload.eventType);
      invalidateQueries();
    },
    [invalidateQueries]
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.log("[REALTIME] Supabase not configured, skipping realtime setup");
      return;
    }

    console.log("[REALTIME] Setting up Supabase realtime subscriptions");

    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        handleUsersChange
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        handleDeliveriesChange
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "courier_profiles",
        },
        handleCourierProfilesChange
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "business_profiles",
        },
        handleBusinessProfilesChange
      )
      .subscribe((status) => {
        console.log("[REALTIME] Subscription status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("[REALTIME] Cleaning up Supabase realtime subscriptions");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    handleUsersChange,
    handleDeliveriesChange,
    handleCourierProfilesChange,
    handleBusinessProfilesChange,
  ]);

  return null;
}
