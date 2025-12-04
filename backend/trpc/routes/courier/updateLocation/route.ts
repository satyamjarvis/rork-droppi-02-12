import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseStore } from "../../../../services/supabaseStore";

const updateLocationSchema = z.object({
  courierId: z.string().min(1, "מזהה שליח נדרש"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const updateLocationRoute = publicProcedure
  .input(updateLocationSchema)
  .mutation(async ({ input }) => {
    console.log("[ROUTE] courier.updateLocation called", input.courierId, input.latitude, input.longitude);
    const result = await supabaseStore.courierUpdateLocation({
      courierId: input.courierId,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    return result;
  });

export default updateLocationRoute;
