import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const updateAvailabilityInput = z.object({
  courierId: z.string().min(1),
  isAvailable: z.boolean(),
});

const updateAvailabilityRoute = publicProcedure.input(updateAvailabilityInput).mutation(async ({ input }) => {
  const user = await supabaseStore.courierUpdateAvailability(input);
  return user;
});

export default updateAvailabilityRoute;
