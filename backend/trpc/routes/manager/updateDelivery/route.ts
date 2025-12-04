import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const updateDeliveryInput = z.object({
  managerId: z.string().min(1),
  deliveryId: z.string().min(1),
  status: z.enum(["waiting", "taken", "completed"]).optional(),
  courierId: z.string().nullable().optional(),
});

const updateDeliveryRoute = publicProcedure.input(updateDeliveryInput).mutation(async ({ input }) => {
  const updated = await supabaseStore.managerUpdateDelivery({
    managerId: input.managerId,
    deliveryId: input.deliveryId,
    status: input.status,
    courierId: typeof input.courierId === "undefined" ? undefined : input.courierId,
  });
  return updated;
});

export default updateDeliveryRoute;
