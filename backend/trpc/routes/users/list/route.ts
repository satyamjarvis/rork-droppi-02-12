import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const usersListRoute = publicProcedure.query(async () => {
  const users = await supabaseStore.getUsers();
  return users;
});

export default usersListRoute;
