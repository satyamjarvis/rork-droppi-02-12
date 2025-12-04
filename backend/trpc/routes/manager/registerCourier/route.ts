import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const registerCourierInput = z.object({
  managerId: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(18),
  phone: z.string().min(1),
  email: z.string().email(),
  vehicle: z.string().min(1),
  password: z.string().min(4),
  idNumber: z.string().optional(),
});

const registerCourierRoute = publicProcedure.input(registerCourierInput).mutation(async ({ input }) => {
  console.log("[TRPC ROUTE] registerCourier called with:", input);
  const courier = await supabaseStore.registerCourier(input);
  console.log("[TRPC ROUTE] registerCourier completed:", courier.id);
  return courier;
});

export default registerCourierRoute;
