import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const registerPushTokenInput = z.object({
  userId: z.string().min(1),
  pushToken: z.string().min(1),
});

const registerPushTokenRoute = publicProcedure.input(registerPushTokenInput).mutation(async ({ input }) => {
  const updatedUser = await supabaseStore.registerPushToken(input.userId, input.pushToken);
  return updatedUser;
});

export default registerPushTokenRoute;
