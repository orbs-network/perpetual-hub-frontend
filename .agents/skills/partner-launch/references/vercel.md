# Vercel for an authorized partner project

Read only when Vercel is selected. Apply the shared
[hosting requirements](hosting-and-activation.md) and preview-first sequence.
Check [current plans](https://vercel.com/docs/plans/hobby), linked use/eligibility
terms and the actual account plan; do not assume a free plan permits this trading
site. Obtain approval for a paid change. These commands are official documented
examples; this procedure has not been tested against a live partner account.

1. Reuse sufficient connected tools or the installed CLI. Check `vercel whoami`,
   the intended account/team, local `.vercel/project.json` and the saved project
   without printing tokens or env files. Use `vercel login` only when needed;
   the creator completes signup/verification/MFA. Resolve stale links or ambiguous
   scope before writes. Never use the fixed Orbs project from `npm run deploy`
   or `scripts/deploy.mjs` for a partner.
2. Reuse the owned project, or create/link only the intended partner project
   using the [current link command](https://vercel.com/docs/cli/link) and verified
   scope. Handle routine prompts yourself; a local link or default CLI scope
   alone does not prove authorization. Preserve `vercel.json`: its Vite preset,
   install/build commands, `dist` output and SPA rewrites belong to this app.
3. Use Vercel's documented local [pull](https://vercel.com/docs/cli/pull),
   [build](https://vercel.com/docs/cli/build) and
   [prebuilt deploy](https://vercel.com/docs/cli/deploy) flow. Plain `dist/` is
   not the `.vercel/output` Build Output API artifact expected by `--prebuilt`.
   For the already verified linked project/scope:

   ```sh
   vercel pull --environment=preview --scope <verified-scope>
   vercel build --scope <verified-scope>
   vercel deploy --prebuilt --scope <verified-scope>
   # Check the preview before preparing the production artifact.
   vercel pull --environment=production --scope <verified-scope>
   vercel build --prod --scope <verified-scope>
   vercel deploy --prebuilt --prod --scope <verified-scope>
   ```

   Verify the project ID before each upload. Preserve the chosen local partner
   ID, branding and WalletConnect status in both build contexts; inspect env
   precedence without dumping values. Do not let pulled settings introduce a
   different tenant or turn a blank optional ID into another app's ID. Export
   only the intended public app values into the build process when needed.
   Pulling is not uploading `.env.local`; dashboard edits require a rebuild.
   Preview/production artifacts may differ: recheck the production artifact
   before upload and never pass a preview-built output as production by adding
   `--prod` only at upload time. Keep all `.vercel/` state private/ignored.
4. Verify the actual stable production alias, HTTPS/assets/routes, desktop/mobile
   and real-origin REST/WebSocket access via the
   [shared live checks](hosting-and-activation.md#verify-the-actual-website-and-activation-separately).
   A protected preview is not evidence that the public production URL works.
   Record project/deployment IDs, stable URL, build provenance and checks.
5. **Run `vercel logout` after every deployment attempt and verification, including
   failure.** Ensure cleanup runs even when build, upload or verification fails.

Inspect deployment/project state after an ambiguous upload before retrying;
do not create another project or switch scope to clear an error. Resolve routine
configuration/install failures first. If tooling/access remains unavailable,
prepare the [build handoff](other-hosting.md#prepare-a-build-the-creator-can-host)
and the actual account action needed. Do not substitute a Git/source upload or
claim the host supports generic folder drag-and-drop without official support.
