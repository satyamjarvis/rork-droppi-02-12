import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";
import { sendNewDeliveryNotificationToAvailableCouriers } from "../../../../services/pushNotificationService";

const createDeliveryInput = z.object({
  businessId: z.string().min(1),
  pickupAddress: z.string().min(1),
  dropoffAddress: z.string().min(1),
  notes: z.string().default(""),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  preparationTimeMinutes: z.number().int().min(1).max(60),
});

const createDeliveryRoute = publicProcedure.input(createDeliveryInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.createDelivery(input);
  
  const users = await supabaseStore.getUsers();
  const business = users.find((u) => u.id === input.businessId);
  const businessName = business?.name ?? "עסק";
  
  const availableCouriers = await supabaseStore.getAvailableCouriersWithTokens();
  
  sendNewDeliveryNotificationToAvailableCouriers(delivery, availableCouriers, businessName)
    .catch((err) => console.log("[PUSH] Failed to send new delivery notifications", err));
  
  return delivery;
});

export default createDeliveryRoute;
