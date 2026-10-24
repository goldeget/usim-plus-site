import { getAdminSession, validatedAdminReturnPath } from "./_lib/admin-auth.js";

const ADMIN_HOST = "admin.climekr.com";
const LOGIN_PAGE = "/admin/login";
const LOGIN_PAGE_ALIASES = new Set([LOGIN_PAGE, "/admin/login.html"]);
const LOGIN_ENDPOINT = "/api/admin/auth/login";

function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function apiUnauthorized() {
  return new Response(JSON.stringify({ error: "관리자 로그인이 필요합니다.", code: "unauthenticated" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function loginLocation(pathname, search = "") {
  const target = new URL(LOGIN_PAGE, "https://admin.climekr.com");
  target.searchParams.set("returnTo", validatedAdminReturnPath(`${pathname}${search}`));
  return target;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const adminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");

  // The public hostname and Pages preview hosts never serve admin assets.
  if (host !== ADMIN_HOST && adminPath) {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (host !== ADMIN_HOST) return context.next();

  if (LOGIN_PAGE_ALIASES.has(url.pathname)) {
    const session = await getAdminSession(request, env);
    if (session) return Response.redirect(new URL(validatedAdminReturnPath(url.searchParams.get("returnTo") || "/"), url.origin), 302);
    return noStore(await context.next());
  }

  // The only unauthenticated function on the admin host creates a session.
  if (url.pathname === LOGIN_ENDPOINT && request.method === "POST") return context.next();

  const isAdminApi = url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/");
  const isAdminUi = url.pathname === "/" || url.pathname === "/index.html" || adminPath;
  if (!isAdminApi && !isAdminUi) return context.next();

  const session = await getAdminSession(request, env);
  if (!session) {
    if (isAdminApi) return apiUnauthorized();
    return Response.redirect(loginLocation(url.pathname, url.search), 302);
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const assetUrl = new URL("/admin/index.html", request.url);
    return noStore(await env.ASSETS.fetch(new Request(assetUrl, request)));
  }

  return noStore(await context.next());
}
