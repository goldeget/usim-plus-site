// Naver Search Advisor fetches this exact .html URL and treats a redirect as failure.
// Pages pretty URLs 308 /<token>.html to /<token>. A Function is served ahead of that redirect.
const TOKEN = "navercb78a18ae519c02b17c8618a7b72822c";

export async function onRequest() {
  return new Response(TOKEN, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
