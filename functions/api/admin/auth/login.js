import { loginAdminRequest } from "../../../_lib/admin-auth.js";

export async function onRequest({ request, env }) {
  return loginAdminRequest(request, env);
}
