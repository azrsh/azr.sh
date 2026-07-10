# azr.sh

Static site served by Cloudflare Pages (`public/`).

## /slides

`/slides/*` is served from an R2 bucket via a Pages Function (`functions/slides/[[path]].js`).
The bucket must be bound as `SLIDES` in the Cloudflare dashboard: Pages > Settings > Bindings > R2 bucket.
