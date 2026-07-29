/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as calls from "../calls.js";
import type * as carrierAssets from "../carrierAssets.js";
import type * as carrierOptions from "../carrierOptions.js";
import type * as carriers from "../carriers.js";
import type * as clients from "../clients.js";
import type * as crons from "../crons.js";
import type * as drivers from "../drivers.js";
import type * as fleetImport from "../fleetImport.js";
import type * as http from "../http.js";
import type * as incidents from "../incidents.js";
import type * as invitations from "../invitations.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_carrierAuthz from "../lib/carrierAuthz.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_needs from "../lib/needs.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_workflow from "../lib/workflow.js";
import type * as matching from "../matching.js";
import type * as memberships from "../memberships.js";
import type * as missions from "../missions.js";
import type * as needs from "../needs.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as portfolios from "../portfolios.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  calls: typeof calls;
  carrierAssets: typeof carrierAssets;
  carrierOptions: typeof carrierOptions;
  carriers: typeof carriers;
  clients: typeof clients;
  crons: typeof crons;
  drivers: typeof drivers;
  fleetImport: typeof fleetImport;
  http: typeof http;
  incidents: typeof incidents;
  invitations: typeof invitations;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/carrierAuthz": typeof lib_carrierAuthz;
  "lib/idempotency": typeof lib_idempotency;
  "lib/needs": typeof lib_needs;
  "lib/notifications": typeof lib_notifications;
  "lib/workflow": typeof lib_workflow;
  matching: typeof matching;
  memberships: typeof memberships;
  missions: typeof missions;
  needs: typeof needs;
  notifications: typeof notifications;
  organizations: typeof organizations;
  portfolios: typeof portfolios;
  reports: typeof reports;
  seed: typeof seed;
  vehicles: typeof vehicles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
