import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const saveCustomerInput = z.object({
  phone: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  floor: z.string().optional(),
  notes: z.string().optional(),
  businessId: z.string().optional(),
});

const saveCustomerRoute = publicProcedure.input(saveCustomerInput).mutation(async ({ input }) => {
  console.log("[CUSTOMER] Saving customer:", input.phone, input.name);
  const customer = await supabaseStore.saveCustomer(input);
  return customer;
});

export default saveCustomerRoute;
