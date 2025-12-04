# WebSocket Real-Time Notifications Implementation

## Overview
I've successfully implemented WebSocket (tRPC subscription) notifications for your delivery management app. When Device A triggers an action, Device B receives that event in real-time and opens a bottom sheet modal automatically.

## What Was Implemented

### 1. Backend Event System
- **Event Emitter** (`backend/services/eventEmitter.ts`): Central event system that emits delivery and user events
- **Event Types**:
  - `DELIVERY_CREATED` - When a business creates a new delivery
  - `DELIVERY_ASSIGNED` - When a courier takes a delivery  
  - `DELIVERY_UPDATED` - General delivery updates
  - `DELIVERY_READY` - When business marks order ready for pickup
  - `DELIVERY_COMPLETED` - When courier completes delivery
  - `USER_CREATED` - When new users are registered
  - `USER_UPDATED` - When user info changes

### 2. Event Emission Points
Updated `deliveryStore.ts` to emit events when:
- Business creates a new delivery → `DELIVERY_CREATED`
- Courier takes a delivery → `DELIVERY_ASSIGNED`  
- Business marks delivery ready → `DELIVERY_READY`
- Courier completes delivery → `DELIVERY_COMPLETED`
- Manager registers new users → `USER_CREATED`
- Courier updates availability → `USER_UPDATED`

### 3. tRPC Subscription Route
- Created `backend/trpc/routes/events/subscribe/route.ts`
- Uses tRPC's `observable` for real-time event streaming
- Added to app router as `events.subscribe`

### 4. Client-Side WebSocket Support
- Updated `lib/trpc.ts` to use `splitLink` with `unstable_httpSubscriptionLink`
- Routes subscription calls through HTTP streaming (works better than WebSocket for Expo)
- Maintains backward compatibility with regular HTTP queries/mutations

### 5. Real-Time Notification Component
Created `RealtimeDeliveryNotifications.tsx` that:
- Subscribes to system events via tRPC
- For **Couriers**: Shows `NewDeliveryBottomSheet` when a new delivery is created
- For **Businesses**: Shows `CourierAssignedBottomSheet` when a courier takes their delivery
- Plays notification sound and triggers haptic feedback
- Respects courier availability status
- Prevents duplicate notifications using dismissal tracking

### 6. Integration
- Added `RealtimeDeliveryNotifications` to root layout
- Works alongside existing `GlobalDeliveryNotifications` (polling-based)
- Both systems complement each other for reliability

## How It Works

### Example Flow 1: Business Creates Delivery → Courier Gets Notified
1. Business (Device A) calls `createDelivery` mutation
2. Backend saves delivery and emits `DELIVERY_CREATED` event
3. Event is broadcast to all subscribed clients
4. Courier (Device B) receives event via WebSocket subscription
5. `RealtimeDeliveryNotifications` shows bottom sheet modal automatically
6. Courier hears notification sound and feels haptic feedback
7. Courier can accept (navigate to available deliveries) or reject

### Example Flow 2: Courier Takes Delivery → Business Gets Notified
1. Courier (Device A) calls `takeDelivery` mutation
2. Backend updates delivery and emits `DELIVERY_ASSIGNED` event
3. Event is broadcast to all subscribed clients
4. Business (Device B) receives event (filtered by businessId)
5. `RealtimeDeliveryNotifications` shows courier assigned modal
6. Business hears notification sound and sees courier info
7. Business clicks "אשר והתחל בהכנה" and navigates to their deliveries

## Key Features

✅ **Real-time**: Instant notifications via HTTP streaming
✅ **Role-based**: Different modals for couriers vs businesses
✅ **Smart filtering**: Only shows relevant events to each user
✅ **Duplicate prevention**: Uses dismissal tracking to avoid spam
✅ **Cross-platform**: Works on web, iOS, and Android
✅ **Sound & Haptics**: Full sensory notifications
✅ **Auto-navigation**: Can automatically route users to relevant screens
✅ **Availability-aware**: Respects courier availability status

## Technical Details

- Uses tRPC's HTTP subscription link (better for Expo than WebSockets)
- Events are typed with TypeScript for safety
- EventEmitter pattern on backend for loose coupling
- Client subscribes once and receives all relevant events
- No polling needed - events push to client immediately

## Testing

To test the real-time notifications:

1. **Test Courier Notifications**:
   - Open app on Device 1 as a courier
   - Open app on Device 2 as a business  
   - Create a delivery from Device 2
   - Device 1 should show new delivery modal instantly

2. **Test Business Notifications**:
   - Open app on Device 1 as a business
   - Open app on Device 2 as a courier
   - Courier takes the business's delivery from Device 2
   - Device 1 should show courier assigned modal instantly

## Console Logs

The system logs extensively for debugging:
- `[EVENT]` - Backend event emission
- `[SUBSCRIPTION]` - Subscription lifecycle
- `[REALTIME]` - Client-side event handling

Check console to verify events are flowing correctly.
