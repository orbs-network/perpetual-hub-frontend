# Perpetual Hub frontend

This is the standalone white-label React/Vite frontend. Work in this repository;
there is no required sibling backend, TEE, contracts or private monorepo checkout.

Read docs/changelog.md before changing code. Preserve documented behavior and
record completed changes plus their test gaps there. Keep each task on its own
codex/ branch unless it is part of the same logical change. Do not add backward
compatibility unless requested.

Use the existing components, partner tokens and translations. Preserve keyboard
access, mobile layouts and the Lightweight Charts order/position interactions. Account
and order authority belongs to the backend/TEE; frontend display calculations
must never replace server validation. Submission prices remain exact 1e18 values
with explicit source conversions and market tick rounding.

For theme, colors, logos, wordmarks, favicon or branding metadata work, read
`.agents/skills/perpetual-hub-theme/SKILL.md` and its relevant appearance reference.
It explains the single-theme configuration, affected surfaces and verification.

Keep all public partner configuration inside src/config/partners.
API, WebSocket and WalletConnect configuration is build-time
only. Never add admin tools, internal operations, proprietary chart bundles,
private service telemetry, real environment files or credentials to this repo.
Do not add mocks to production or browser E2E code; unit-test mocks are allowed.

Run npm run check:public, npm run typecheck, npm run lint and npm run build.
Browser-check visible changes on desktop and mobile. Report what changed, the
checks performed and coverage limits in plain language. This repository has no
automated test suite or recorded financial regression fixtures. Type and build
checks do not prove parity with the backend/TEE; financial changes still require
an independent integration check against the current authority.

Do not commit, push, publish or deploy unless requested. After any Vercel
deployment attempt and verification, run vercel logout, including on failure.
