import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import usersListRoute from "./routes/users/list/route";
import registerPushTokenRoute from "./routes/users/registerPushToken/route";
import testPushRoute from "./routes/users/testPush/route";
import deliveriesListRoute from "./routes/deliveries/list/route";
import loginRoute from "./routes/auth/login/route";
import registerCourierRoute from "./routes/manager/registerCourier/route";
import registerBusinessRoute from "./routes/manager/registerBusiness/route";
import registerManagerRoute from "./routes/manager/registerManager/route";
import updateDeliveryRoute from "./routes/manager/updateDelivery/route";
import updateUserRoute from "./routes/manager/updateUser/route";
import createDeliveryRoute from "./routes/business/createDelivery/route";
import confirmDeliveryRoute from "./routes/business/confirmDelivery/route";
import markReadyRoute from "./routes/business/markReady/route";
import takeDeliveryRoute from "./routes/courier/takeDelivery/route";
import pickupDeliveryRoute from "./routes/courier/pickupDelivery/route";
import completeDeliveryRoute from "./routes/courier/completeDelivery/route";
import updateAvailabilityRoute from "./routes/courier/updateAvailability/route";
import updateLocationRoute from "./routes/courier/updateLocation/route";
import subscribeRoute from "./routes/events/subscribe/route";
import lookupCustomerRoute from "./routes/customers/lookup/route";
import saveCustomerRoute from "./routes/customers/save/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  users: createTRPCRouter({
    list: usersListRoute,
    registerPushToken: registerPushTokenRoute,
    testPush: testPushRoute,
  }),
  deliveries: createTRPCRouter({
    list: deliveriesListRoute,
  }),
  auth: createTRPCRouter({
    login: loginRoute,
  }),
  manager: createTRPCRouter({
    registerCourier: registerCourierRoute,
    registerBusiness: registerBusinessRoute,
    registerManager: registerManagerRoute,
    updateDelivery: updateDeliveryRoute,
    updateUser: updateUserRoute,
  }),
  business: createTRPCRouter({
    createDelivery: createDeliveryRoute,
    confirmDelivery: confirmDeliveryRoute,
    markReady: markReadyRoute,
  }),
  courier: createTRPCRouter({
    takeDelivery: takeDeliveryRoute,
    pickupDelivery: pickupDeliveryRoute,
    completeDelivery: completeDeliveryRoute,
    updateAvailability: updateAvailabilityRoute,
    updateLocation: updateLocationRoute,
  }),
  events: createTRPCRouter({
    subscribe: subscribeRoute,
  }),
  customers: createTRPCRouter({
    lookup: lookupCustomerRoute,
    save: saveCustomerRoute,
  }),
});

export type AppRouter = typeof appRouter;
