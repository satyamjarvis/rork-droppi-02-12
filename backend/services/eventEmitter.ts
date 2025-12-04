import { EventEmitter } from "events";
import { Delivery, User } from "../../types/models";

export type DeliveryEvent = {
  type: "DELIVERY_CREATED" | "DELIVERY_UPDATED" | "DELIVERY_ASSIGNED" | "DELIVERY_READY" | "DELIVERY_COMPLETED";
  delivery: Delivery;
  timestamp: string;
};

export type UserEvent = {
  type: "USER_CREATED" | "USER_UPDATED";
  user: User;
  timestamp: string;
};

export type SystemEvent = DeliveryEvent | UserEvent;

class SystemEventEmitter extends EventEmitter {
  emitDeliveryCreated(delivery: Delivery) {
    const event: DeliveryEvent = {
      type: "DELIVERY_CREATED",
      delivery,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting DELIVERY_CREATED", delivery.id);
    this.emit("system:event", event);
    this.emit("delivery:created", event);
  }

  emitDeliveryUpdated(delivery: Delivery) {
    const event: DeliveryEvent = {
      type: "DELIVERY_UPDATED",
      delivery,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting DELIVERY_UPDATED", delivery.id);
    this.emit("system:event", event);
    this.emit("delivery:updated", event);
  }

  emitDeliveryAssigned(delivery: Delivery) {
    const event: DeliveryEvent = {
      type: "DELIVERY_ASSIGNED",
      delivery,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting DELIVERY_ASSIGNED", delivery.id);
    this.emit("system:event", event);
    this.emit("delivery:assigned", event);
  }

  emitDeliveryReady(delivery: Delivery) {
    const event: DeliveryEvent = {
      type: "DELIVERY_READY",
      delivery,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting DELIVERY_READY", delivery.id);
    this.emit("system:event", event);
    this.emit("delivery:ready", event);
  }

  emitDeliveryCompleted(delivery: Delivery) {
    const event: DeliveryEvent = {
      type: "DELIVERY_COMPLETED",
      delivery,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting DELIVERY_COMPLETED", delivery.id);
    this.emit("system:event", event);
    this.emit("delivery:completed", event);
  }

  emitUserCreated(user: User) {
    const event: UserEvent = {
      type: "USER_CREATED",
      user,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting USER_CREATED", user.id);
    this.emit("system:event", event);
    this.emit("user:created", event);
  }

  emitUserUpdated(user: User) {
    const event: UserEvent = {
      type: "USER_UPDATED",
      user,
      timestamp: new Date().toISOString(),
    };
    console.log("[EVENT] Emitting USER_UPDATED", user.id);
    this.emit("system:event", event);
    this.emit("user:updated", event);
  }
}

export const systemEvents = new SystemEventEmitter();
