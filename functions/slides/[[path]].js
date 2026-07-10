/**
 * Serves /slides/* from the R2 bucket bound as `SLIDES`
 * (configured in the Cloudflare dashboard: Pages > Settings > Bindings).
 */

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

export async function onRequestGet(context) {
  const { pathname } = new URL(context.request.url);
  const key = resolveKey(pathname);

  const object = await context.env.SLIDES.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
