import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const registerBusinessInput = z.object({
  managerId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
});

const registerBusinessRoute = publicProcedure.input(registerBusinessInput).mutation(async ({ input }) => {
  console.log("[TRPC ROUTE] registerBusiness called with:", input);
  const business = await supabaseStore.registerBusiness(input);
  console.log("[TRPC ROUTE] registerBusiness completed:", business.id);
  return business;
});

export default registerBusinessRoute;
