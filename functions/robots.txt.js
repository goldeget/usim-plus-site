// Public crawl policy: everything is crawlable except admin and API routes.
// Public content sections: / (home), /about/, /guide/, /structure/, /reviews/, /disclosures/.
const PUBLIC_ROBOTS = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://climekr.com/sitemap.xml
`;

const ADMIN_ROBOTS = `User-agent: *
Disallow: /
`;

const PREVIEW_ROBOTS = `User-agent: *
Allow: /
`;

export async function onRequest({ request }) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const body = hostname === "admin.climekr.com"
    ? ADMIN_ROBOTS
    : hostname === "climekr.com"
      ? PUBLIC_ROBOTS
      : PREVIEW_ROBOTS;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
      ...(hostname === "climekr.com" || hostname === "admin.climekr.com" ? {} : { "X-Robots-Tag": "noindex, nofollow" })
    }
  });
}
