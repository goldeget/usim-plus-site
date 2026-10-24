import { logoutAdminRequest } from "../../../_lib/admin-auth.js";

export async function onRequest({ request, env }) {
  return logoutAdminRequest(request, env);
}
