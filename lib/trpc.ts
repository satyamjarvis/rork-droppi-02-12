import { createTRPCReact } from "@trpc/react-query";
import { httpLink, splitLink, unstable_httpSubscriptionLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl) {
    console.log("Using EXPO_PUBLIC_RORK_API_BASE_URL", envUrl);
    return envUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    console.log("Using browser origin for API base URL", origin);
    return origin;
  }

  console.warn("No base URL configured, backend requests will fail");
  return "";
};

const createFetchWithTimeout = () => {
  return async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    const timeoutMs = 30000;
    const urlString = typeof url === 'string' ? url : url.toString();
    console.log(`[TRPC] Fetch request to: ${urlString}`);
    console.log(`[TRPC] Method: ${options?.method || 'GET'}`);
    console.log(`[TRPC] Headers:`, options?.headers);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      console.log(`[TRPC] Response status: ${response.status}`);
      console.log(`[TRPC] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const text = await response.clone().text();
        console.error(`[TRPC] Error response body:`, text);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[TRPC] Fetch error:`, errorMessage);
      
      if (errorMessage.toLowerCase().includes("abort")) {
        throw new Error("Request timeout");
      }
      throw error;
    }
  };
};

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: unstable_httpSubscriptionLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
      }),
      false: httpLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
        fetch: createFetchWithTimeout(),
      }),
    }),
  ],
});
