import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const takeDeliveryInput = z.object({
  courierId: z.string().min(1),
  deliveryId: z.string().min(1),
  estimatedArrivalMinutes: z.number().int().min(1).max(60),
});

const takeDeliveryRoute = publicProcedure.input(takeDeliveryInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.courierTakeDelivery({
    courierId: input.courierId,
    deliveryId: input.deliveryId,
    estimatedArrivalMinutes: input.estimatedArrivalMinutes,
  });
  return delivery;
});

export default takeDeliveryRoute;
