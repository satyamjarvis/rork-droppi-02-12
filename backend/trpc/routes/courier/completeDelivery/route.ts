import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const completeDeliveryInput = z.object({
  courierId: z.string().min(1),
  deliveryId: z.string().min(1),
});

const completeDeliveryRoute = publicProcedure.input(completeDeliveryInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.courierCompleteDelivery(input);
  return delivery;
});

export default completeDeliveryRoute;
