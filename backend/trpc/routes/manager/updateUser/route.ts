import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseStore } from "../../../../services/supabaseStore";

const updateUserInput = z.object({
  managerId: z.string(),
  userId: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  courierProfile: z.object({
    age: z.number().optional(),
    vehicle: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  businessProfile: z.object({
    address: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
});

const updateUserRoute = publicProcedure
  .input(updateUserInput)
  .mutation(async ({ input }) => {
    console.log("[updateUser] Manager updating user:", input.userId);
    const result = await supabaseStore.managerUpdateUser(input);
    return result;
  });

export default updateUserRoute;
