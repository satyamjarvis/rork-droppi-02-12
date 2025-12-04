import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const loginInput = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

const loginRoute = publicProcedure.input(loginInput).mutation(async ({ input }) => {
  try {
    console.log("[LOGIN ROUTE] Attempting login for phone:", input.phone);
    const user = await supabaseStore.login(input.phone, input.password);
    console.log("[LOGIN ROUTE] Login successful for user:", user.id);
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "שגיאה בהתחברות";
    console.error("[LOGIN ROUTE] Login failed:", errorMessage);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errorMessage,
    });
  }
});

export default loginRoute;
