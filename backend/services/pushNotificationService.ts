import { User, Delivery } from "../../types/models";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  sound?: "default" | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  ttl?: number;
  priority?: "default" | "normal" | "high";
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) {
    console.log("[PUSH] No messages to send");
    return [];
  }

  try {
    console.log("[PUSH] Sending", messages.length, "push notifications");
    
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.log("[PUSH] Failed to send push notifications", response.status, response.statusText);
      return [];
    }

    const result = await response.json() as { data: ExpoPushTicket[] };
    console.log("[PUSH] Push notifications sent", result.data?.length ?? 0, "tickets");
    
    result.data?.forEach((ticket, index) => {
      if (ticket.status === "error") {
        console.log("[PUSH] Error for message", index, ticket.message, ticket.details?.error);
      }
    });

    return result.data ?? [];
  } catch (error) {
    console.log("[PUSH] Error sending push notifications", error);
    return [];
  }
}

export async function sendNewDeliveryNotificationToAvailableCouriers(
  delivery: Delivery,
  availableCouriers: User[],
  businessName: string
): Promise<void> {
  const couriersWithTokens = availableCouriers.filter(
    (courier) => 
      courier.role === "courier" && 
      courier.courierProfile?.isAvailable === true && 
      courier.pushToken
  );

  if (couriersWithTokens.length === 0) {
    console.log("[PUSH] No available couriers with push tokens to notify");
    return;
  }

  console.log("[PUSH] Notifying", couriersWithTokens.length, "available couriers about new delivery");

  const messages: ExpoPushMessage[] = couriersWithTokens.map((courier) => ({
    to: courier.pushToken!,
    sound: "default" as const,
    title: "🛵 משלוח חדש זמין!",
    body: `${businessName} - ${delivery.dropoffAddress}`,
    data: {
      type: "new_delivery",
      deliveryId: delivery.id,
      pickupAddress: delivery.pickupAddress,
      dropoffAddress: delivery.dropoffAddress,
    },
    priority: "high" as const,
    ttl: 60 * 5,
  }));

  await sendPushNotifications(messages);
}

export async function sendDeliveryReadyNotification(
  delivery: Delivery,
  courier: User
): Promise<void> {
  if (!courier.pushToken) {
    console.log("[PUSH] Courier has no push token", courier.id);
    return;
  }

  console.log("[PUSH] Sending delivery ready notification to courier", courier.id);

  const messages: ExpoPushMessage[] = [{
    to: courier.pushToken,
    sound: "default" as const,
    title: "✅ ההזמנה מוכנה!",
    body: `ההזמנה מ-${delivery.pickupAddress} מוכנה לאיסוף`,
    data: {
      type: "delivery_ready",
      deliveryId: delivery.id,
    },
    priority: "high" as const,
  }];

  await sendPushNotifications(messages);
}

export async function sendDeliveryAssignedNotification(
  delivery: Delivery,
  business: User
): Promise<void> {
  if (!business.pushToken) {
    console.log("[PUSH] Business has no push token", business.id);
    return;
  }

  console.log("[PUSH] Sending delivery assigned notification to business", business.id);

  const messages: ExpoPushMessage[] = [{
    to: business.pushToken,
    sound: "default" as const,
    title: "🚀 שליח קיבל את ההזמנה!",
    body: `שליח לקח את המשלוח ל-${delivery.dropoffAddress}`,
    data: {
      type: "delivery_assigned",
      deliveryId: delivery.id,
    },
    priority: "high" as const,
  }];

  await sendPushNotifications(messages);
}
