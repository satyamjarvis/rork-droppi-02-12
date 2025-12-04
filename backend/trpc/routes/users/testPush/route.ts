import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const testPushInput = z.object({
  userId: z.string().min(1),
});

const testPushRoute = publicProcedure.input(testPushInput).mutation(async ({ input }) => {
  const users = await supabaseStore.getUsers();
  const user = users.find((u) => u.id === input.userId);

  if (!user) {
    throw new Error("משתמש לא נמצא");
  }

  if (!user.pushToken) {
    throw new Error("אין push token רשום למשתמש. נסה לפתוח את האפליקציה מחדש.");
  }

  console.log("[TEST PUSH] Sending test push to user:", user.id, "token:", user.pushToken.substring(0, 30) + "...");

  const message = {
    to: user.pushToken,
    sound: "default" as const,
    title: "🔔 בדיקת התראות",
    body: "זוהי הודעת בדיקה - Push Notifications עובדים!",
    data: {
      type: "test",
      timestamp: new Date().toISOString(),
    },
    priority: "high" as const,
  };

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify([message]),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("[TEST PUSH] Failed:", response.status, errorText);
    throw new Error(`שליחת ההתראה נכשלה: ${response.status}`);
  }

  const result = await response.json() as { data: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }> };
  console.log("[TEST PUSH] Result:", JSON.stringify(result));

  const ticket = result.data?.[0];
  if (ticket?.status === "error") {
    console.log("[TEST PUSH] Ticket error:", ticket.message, ticket.details?.error);
    throw new Error(`שגיאה בשליחה: ${ticket.message || ticket.details?.error}`);
  }

  return {
    success: true,
    ticketId: ticket?.id,
  };
});

export default testPushRoute;
