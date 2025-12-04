import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const markReadyInput = z.object({
  businessId: z.string().min(1),
  deliveryId: z.string().min(1),
});

const markReadyRoute = publicProcedure.input(markReadyInput).mutation(async ({ input }) => {
  const delivery = await supabaseStore.businessMarkReady({
    businessId: input.businessId,
    deliveryId: input.deliveryId,
  });
  return delivery;
});

export default markReadyRoute;
