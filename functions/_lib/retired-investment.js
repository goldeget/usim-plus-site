// First path segments from the retired investment platform.
// Match a whole segment so /apple-touch-icon.png is not treated as /app.
const RETIRED_FIRST_SEGMENTS = new Set([
  "ops",
  "partners",
  "en",
  "support",
  "help",
  "events",
  "community",
  "invest",
  "legal",
  "trust",
  "login",
  "signin",
  "signup",
  "sign-up",
  "register",
  "auth",
  "logout",
  "app",
  "wallet",
  "account",
  "mypage",
  "my-page",
  "dashboard",
  "profile",
  "settings",
  "assets",
  "asset",
  "products",
  "product",
  "program",
  "programs",
  "missions",
  "mission",
  "notices",
  "notice",
  "news",
  "press",
  "blog",
  "withdraw",
  "withdrawal",
  "deposit",
  "green-energy",
  "ai-power",
  "robot",
  "robots",
  "facilities",
  "facility",
  "company",
  "terms",
  "privacy",
  "risk",
  "faq",
  "download",
  "install",
  "ko",
  "ja",
  "zh",
  "cn",
  "jp",
  "portfolio",
  "market",
  "markets",
  "referral",
  "invite",
  "points",
  "benefits",
  "benefit",
  "promo",
  "promotion",
  "campaign",
  "campaigns",
  "notifications",
  "notification",
  "kyc",
  "verify",
  "verification",
  "contracts",
  "contract",
  "plans",
  "plan",
  "yield",
  "yields",
  "income",
  "usdt",
  "tether",
  "crypto",
  "onboarding",
  "stories",
  "story",
  "brands",
  "certifications"
]);

export function isRetiredInvestmentPath(pathname) {
  let path = String(pathname || "/");
  try {
    path = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (path.includes("\0")) return false;
  const segment = path.toLowerCase().split("/").filter(Boolean)[0];
  return Boolean(segment) && RETIRED_FIRST_SEGMENTS.has(segment);
}

export function retiredInvestmentGone() {
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>종료된 페이지 | 클라임유심 CLIME</title>
  <meta name="description" content="이 주소의 이전 페이지는 종료되었습니다. 현재 climekr.com의 CLIME은 서울평가정보㈜가 운영하는 유심 개통 혜택 안내입니다.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse 65% 35% at 50% 0%,#1f487d,transparent),linear-gradient(#0a1b35,#060e1c);color:#eff6ff;font-family:Pretendard,"Apple SD Gothic Neo",system-ui,sans-serif}
    main{width:min(92%,560px);padding:48px 22px;text-align:center}
    .eyebrow{font-weight:800;color:#83d6ff;font-size:14px;letter-spacing:.14em}
    h1{font-size:clamp(28px,6vw,40px);letter-spacing:-.04em;margin:12px 0 16px}
    p{font-size:16px;line-height:1.8;color:#c4d5e7;margin:0 0 22px}
    .actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
    a{display:inline-flex;align-items:center;justify-content:center;min-width:160px;min-height:52px;padding:14px 18px;border-radius:14px;font-weight:800;text-decoration:none;background:#72dcef;color:#073053}
    a.secondary{background:#10294d;border:1px solid #5384b4;color:#ebf7ff}
  </style>
</head>
<body>
<main>
  <div class="eyebrow">CLIME · 클라임유심</div>
  <h1>이 페이지는 종료되었습니다</h1>
  <p>요청하신 주소의 이전 안내는 더 이상 제공되지 않습니다. 지금 climekr.com의 CLIME은 서울평가정보㈜가 운영하는 유심 개통 혜택 안내입니다.</p>
  <div class="actions">
    <a href="/">유심 혜택 홈</a>
    <a class="secondary" href="/about/">CLIME 소개</a>
  </div>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  });
}
