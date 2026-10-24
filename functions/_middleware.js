export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // The public hostname must never serve the private editor route.
  if (host !== "manage.climekr.com" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if (host === "manage.climekr.com") {
    const expectedEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
    const authenticatedEmail = String(request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
    const accessAssertion = request.headers.get("cf-access-jwt-assertion");
    if (!expectedEmail || !authenticatedEmail || authenticatedEmail !== expectedEmail || !accessAssertion) {
      return new Response("관리자 인증이 필요합니다.", {
        status: expectedEmail ? 403 : 503,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // Only the dedicated, Access-authenticated management hostname may render the editor.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const assetUrl = new URL("/admin/index.html", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
  }

  return context.next();
}
