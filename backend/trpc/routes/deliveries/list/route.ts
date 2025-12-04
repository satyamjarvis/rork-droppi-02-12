import { supabaseStore } from "../../../../services/supabaseStore";
import { publicProcedure } from "../../../create-context";

const deliveriesListRoute = publicProcedure.query(async () => {
  const deliveries = await supabaseStore.getDeliveries();
  return deliveries;
});

export default deliveriesListRoute;
