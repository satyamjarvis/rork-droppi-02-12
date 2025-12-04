import { publicProcedure } from "../../../create-context";
import { systemEvents, SystemEvent } from "../../../../services/eventEmitter";
import { observable } from "@trpc/server/observable";

export const subscribeRoute = publicProcedure.subscription(() => {
  console.log("[SUBSCRIPTION] Client connected to system events");

  return observable<SystemEvent>((emit) => {
    const onEvent = (event: SystemEvent) => {
      console.log("[SUBSCRIPTION] Emitting event to client:", event.type);
      emit.next(event);
    };

    systemEvents.on("system:event", onEvent);

    console.log("[SUBSCRIPTION] Event listener registered");

    return () => {
      console.log("[SUBSCRIPTION] Client disconnected from system events");
      systemEvents.off("system:event", onEvent);
    };
  });
});

export default subscribeRoute;
