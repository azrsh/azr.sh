/**
 * Serves /slides/* from the R2 bucket bound as `SLIDES`
 * (configured in the Cloudflare dashboard: Pages > Settings > Bindings).
 * "/slides/" itself is a dynamically generated listing of the bucket's
 * top-level prefixes, cached at the edge.
 */

const INDEX_CACHE_CONTROL = "public, max-age=60, s-maxage=600";

/**
 * Maps a request pathname to an R2 object key. The "/slides" prefix is
 * stripped, and paths without a file extension resolve to their index.html
 * (e.g. "/slides/my-talk" and "/slides/my-talk/" -> "my-talk/index.html").
 *
 * @param {string} pathname - URL pathname, always starting with "/slides"
 * @returns {string} R2 object key
 */
function resolveKey(pathname) {
  const key = decodeURIComponent(pathname).replace(/^\/slides\/?/, "");
  if (key === "" || key.endsWith("/")) return key + "index.html";
  if (!key.split("/").pop().includes(".")) return key + "/index.html";
  return key;
}

function escapeHtml(text) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  return text.replace(/[&<>"]/g, (c) => replacements[c]);
}

function renderIndex(names) {
  const list =
    names.length === 0
      ? "<p>No slides yet.</p>"
      : `<ul>
          ${names
            .map(
              (name) =>
                `<li><a href="/slides/${encodeURIComponent(name)}/">${escapeHtml(name)}</a></li>`,
            )
            .join("\n          ")}
        </ul>`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>azrsh's slides</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Slides</h1>
      </header>
      <main>
        ${list}
      </main>
      <footer>
        <small>© 2025 @azrsh</small>
      </footer>
    </div>
  </body>
</html>
`;
}

async function serveIndex(context) {
  const cache = caches.default;
  // Normalize "/slides" and "/slides/" to a single cache entry.
  const cacheKey = new Request(new URL("/slides/", context.request.url));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const listing = await context.env.SLIDES.list({ delimiter: "/" });
  const names = listing.delimitedPrefixes.map((prefix) => prefix.slice(0, -1));
  const response = new Response(renderIndex(names), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": INDEX_CACHE_CONTROL,
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function notFound(context) {
  const page = await context.env.ASSETS.fetch(
    new URL("/404.html", context.request.url),
  );
  return new Response(page.body, {
    status: 404,
    headers: {
      "content-type":
        page.headers.get("content-type") ?? "text/plain; charset=utf-8",
    },
  });
}

export async function onRequestGet(context) {
  const { pathname } = new URL(context.request.url);
  if (pathname === "/slides" || pathname === "/slides/") {
    return serveIndex(context);
  }

  const object = await context.env.SLIDES.get(resolveKey(pathname));
  if (!object) {
    return notFound(context);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
