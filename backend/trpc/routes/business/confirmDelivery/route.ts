import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const confirmDeliveryInput = z.object({
  businessId: z.string().min(1),
  deliveryId: z.string().min(1),
});

const confirmDeliveryRoute = publicProcedure.input(confirmDeliveryInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.businessConfirmDelivery({
    businessId: input.businessId,
    deliveryId: input.deliveryId,
  });
  return delivery;
});

export default confirmDeliveryRoute;
