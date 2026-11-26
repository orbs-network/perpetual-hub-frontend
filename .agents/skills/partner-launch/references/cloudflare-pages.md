# Cloudflare Pages Direct Upload

Read only when Cloudflare Pages is selected. Apply the shared
[hosting requirements](hosting-and-activation.md), preview-first sequence and
four-status handoff. Consult current official [Direct Upload guidance](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
and [pricing/terms](https://www.cloudflare.com/plans/developer-platform/) before use.
These commands are documented examples, not a live-tested deployment.

1. Reuse an available sufficient tool or installed Wrangler; prepare a compatible
   CLI in user space if needed without changing the app's dependencies just for
   deployment. Inspect `wrangler whoami` and the recorded account/project with
   read-only operations. Follow [official authentication guidance](https://developers.cloudflare.com/workers/wrangler/commands/general/)
   and run `wrangler login` only when needed; the creator handles signup/MFA.
   Verify account ID and project ownership before writes. Do not print credentials
   or ask the creator to supply a token.
2. Reuse the intended Pages project and production branch. For a new Direct
   Upload project, choose the branch label yourself and record it; it need not
   match or change the local Git branch. Check naming/plan eligibility before
   `wrangler pages project create <project-name> --production-branch <branch>`.
   Read installed help and use the verified account context, never a guessed
   default account. Record the actual returned hostname; do not promise an exact
   name before acceptance. Direct Upload cannot later switch that project to
   Git integration; preserve existing integration choices on updates.
3. Confirm the checked static output (currently `dist/`) and inspect for unintended
   functions, `_worker.js`, secrets or provider configuration. Preserve routing
   and security headers. Check [Pages SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/):
   a top-level `404.html` changes the automatic SPA fallback. Do not delete an
   existing file blindly; resolve the intended fallback and verify real assets
   and deep-link refreshes. Do not introduce Workers/functions for this static app.
4. Use explicit project and branch flags so Wrangler does not deploy based on
   the current local Git branch. Replace placeholders using verified records:

   ```sh
   wrangler pages deploy dist --project-name <project-name> --branch <preview-branch>
   # After checking the preview, upload the same build to the production branch.
   wrangler pages deploy dist --project-name <project-name> --branch <production-branch>
   ```

   Preview and production branch labels must differ. Confirm the final target,
   returned deployment ID and stable production URL. Branch labels are agent
   implementation choices, not partner questions. Do not upload an archive with
   Wrangler; its Direct Upload expects a folder. Site settings cannot change
   values already embedded in this build.
5. Verify HTTPS, branding, assets, deep links, desktop/mobile and actual-origin
   REST/WebSocket access through the [shared live checks](hosting-and-activation.md#verify-the-actual-website-and-activation-separately).
   Keep `.wrangler/` and any local provider state ignored; record only non-secret
   IDs, URLs, branch labels, build provenance, checks and blockers in `DEPLOYMENT.md`.

For an upload/network failure, inspect the deployment list and remote state before
retrying the same project; do not create a duplicate. Check current file/count
limits. Use the official dashboard's Direct Upload flow as an agent-operated
fallback when compatible; existing Git-integrated projects have different upload
options. If user takeover is unavoidable, provide the actual project/upload page
and prepared build path with one plain next action. If access remains unavailable,
follow the [build handoff](other-hosting.md#prepare-a-build-the-creator-can-host).
