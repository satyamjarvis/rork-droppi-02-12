import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const registerManagerInput = z.object({
  managerId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
});

const registerManagerRoute = publicProcedure.input(registerManagerInput).mutation(async ({ input }) => {
  console.log("[TRPC ROUTE] registerManager called with:", input);
  const manager = await supabaseStore.registerManager(input);
  console.log("[TRPC ROUTE] registerManager completed:", manager.id);
  return manager;
});

export default registerManagerRoute;
