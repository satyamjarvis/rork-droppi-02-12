import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const lookupCustomerInput = z.object({
  phone: z.string().min(1),
});

const lookupCustomerRoute = publicProcedure.input(lookupCustomerInput).query(async ({ input }) => {
  console.log("[CUSTOMER] Looking up customer by phone:", input.phone);
  const customer = await supabaseStore.getCustomerByPhone(input.phone);
  return customer;
});

export default lookupCustomerRoute;
