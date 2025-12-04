import { z } from "zod";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const loginInput = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const loginRoute = publicProcedure.input(loginInput).mutation(async ({ input }) => {
  const user = await supabaseStore.login(input.phone, input.password);
  return user;
});

export default loginRoute;
