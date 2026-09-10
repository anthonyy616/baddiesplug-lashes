// Sentry instrumentation is optional.
// To enable Sentry, install @sentry/nextjs: npm install @sentry/nextjs
// Then uncomment the code below.

// import * as Sentry from "@sentry/nextjs";

// export async function register() {
//   if (process.env.NEXT_RUNTIME === "nodejs") {
//     await import("../sentry.server.config");
//   }

//   if (process.env.NEXT_RUNTIME === "edge") {
//     await import("../sentry.edge.config");
//   }
// }

// export const onRequestError = Sentry.captureRequestError;
