import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const pickupDeliveryInput = z.object({
  courierId: z.string().min(1),
  deliveryId: z.string().min(1),
});

const pickupDeliveryRoute = publicProcedure.input(pickupDeliveryInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.courierPickupDelivery(input);
  return delivery;
});

export default pickupDeliveryRoute;
