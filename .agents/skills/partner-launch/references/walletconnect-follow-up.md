# Optional mobile-wallet setup after launch

Read this when preparing the final handoff for missing/deferred WalletConnect
setup, or when the partner later explicitly requests that update. Paths are
relative to the app repository root. This is not part of branding or hosting setup.

Use the shared [WalletConnect setup skill](https://github.com/orbs-network/agent-skills/blob/master/skills/walletconnect-setup/SKILL.md) for the common Reown workflow. Keep the Perps-specific behavior below. If the shared skill cannot be accessed, use this complete local procedure and report that it was unavailable.

Read that guidance yourself; do not ask the creator to install or invoke it.
If the GitHub page is inaccessible, try its official raw file once, then use
this local fallback and note the source limitation in `DEPLOYMENT.md`. The
launch's deferred-setup rule below takes precedence over any interactive setup
steps: reading a shared skill does not make a missing ID a launch requirement.

When no partner-owned project ID was supplied/configured, finish the launch and
save concise written instructions in `DEPLOYMENT.md` and link them from the
final handoff. Do not add a second immediate task list for the creator. Explain
that QR/mobile
wallet pairing is not configured yet. Installed browser wallets remain supported
once trading is active; while approval is pending, all connection controls are
hidden. Adding a WalletConnect ID does not activate trading or remove the
coming-soon notice. Record **setup deferred; instructions provided** in
`DEPLOYMENT.md`, not a successful pairing check or an explicit opt-out.

Write instructions for the partner to do later; do not execute an account/browser
walkthrough or ask them to complete these steps before publishing:

1. Visit [Reown Dashboard](https://dashboard.reown.com/), sign in to their own
   account, and create a project for this app (or reuse its existing owned
   project). Check the [current plan/pricing](https://reown.com/pricing) before
   accepting any charges. Copy the public **Project ID**, which is different
   from the dPERPS partner ID. No recovery phrase or private key is needed.
2. In the project's origin allowlist, add this site's exact published origin.
   Fill in the actual verified URL in the notes, including `https://` and no
   path. Add draft origins only if pairing will be tested on those drafts;
   preserve needed existing entries. Link the
   [Reown relay/allowlist guide](https://docs.reown.com/cloud/relay). If publication
   is pending, say so rather than inventing a hostname.
3. Return to the agent with the public Project ID and ask it to configure
   WalletConnect, rebuild and redeploy the app to the same recorded hosting site
   (or prepare an updated build if the creator hosts it themselves).
   Include the actual source folder and this follow-up prompt in the notes:
   “Configure WalletConnect for my app using the public Project ID I provide.
   Read AGENTS.md, partner-launch and DEPLOYMENT.md. Set the build-time ID, run
   the checks, rebuild and redeploy to the existing site, or prepare the updated
   self-hosted build; verify QR/mobile pairing where reachable.” The partner
   does not need to edit files or run commands.

For that later requested update, set `VITE_WALLETCONNECT_PROJECT_ID` in ignored
`.env.local`, preserve unrelated settings, restart/rebuild, and follow the same-site
checks/deployment procedure. A dashboard env edit alone cannot change an already
uploaded static build. Report actual pairing separately from merely showing a
wallet option; keep discovery or connectivity blockers explicit.

If a valid partner-owned ID was already supplied, configure and verify it within
the normal launch without this missing-ID task list. Do not open Reown or pause
for wallet-account access to verify its allowlist; if origin setup cannot be
verified, include only the relevant written allowlist steps and mark it pending.
Interactive Reown setup is an optional later task only when explicitly requested.
