export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // The public hostname must never serve the private editor route.
  if (host !== "manage.climekr.com" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  // Only the dedicated management hostname may render the editor.
  if (host === "manage.climekr.com" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const assetUrl = new URL("/admin/index.html", request.url);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }

  return context.next();
}
