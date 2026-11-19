# Deployment record and future updates

Keep customized source in the permanent folder. Create a private source backup
before updates and after launch at
`~/Documents/dPERPS/backups/<folder-name>-source-YYYYMMDD-HHmm.tar.gz` (or the user's
authorized private destination). Exclude real env files, credentials/proofs,
`.git`, provider/session state, `node_modules` and build output. Retain the
lockfile, public `.env.example`, licenses and all local customizations. Do not
upload this backup to a new service without authorization.

Write private, ignored **`DEPLOYMENT.md` in the project root** using this format.
Replace descriptions with actual values; record configured status, never secrets:

```markdown
# Deployment
- Project / requested and confirmed Partner ID / requested networks:
- Permanent source folder / upstream repository and exact commit / local changes:
- Tool versions and paths:
- Branding: name / logo or text-only / dark or light / primary color:
- Supplied, logo-derived or defaulted inputs / final background and accent seeds:
- Original/copied asset paths / preview reviewed / accepted or review delegated:
- Requested ID preserved / real discovery result / coming-soon or active state:
- Requested Netlify name / accepted or generated name / provider-confirmed availability:
- Provider / account and team / verified site ID / stable production URL:
- Netlify hosting badge: project-wide disabled / clean desktop-mobile verification / plan restriction or blocker:
- Last draft URL / deployment ID and date:
- Pricing checked at / official sources / actual plan and spending decision:
- Public build variables: names and configured/blank status only:
- WalletConnect: owning account / project dashboard URL / setup configured, deferred (instructions provided) or explicitly skipped / allowed site origins:
- Checks: source/type/lint/build; draft/live HTTPS/assets/routes/mobile/keyboard:
- Browser REST/CORS / WebSocket / WalletConnect: passed, pending or blocked + why:
- Website published: URL or pending reason:
- Coming-soon toast / read-only actions (empty discovery), or Retry error: observed result:
- Trading activation pending: team contact, assignment/discovery/network/origin tasks:
- Private backup path and date:

## Next update
Update my dPERPS app in <actual-permanent-folder>. Read AGENTS.md,
.agents/skills/partner-launch/SKILL.md and DEPLOYMENT.md. Back up my source,
preserve my branding, run the checks and redeploy to the same recorded site and
stable URL. Report the link and remaining team work.
```

Future explicit updates reuse this source and verified site; do not create a new
one or automatically pull upstream. Review requested upstream changes, preserve
customizations, back up first, rerun checks and the draft/live sequence. Update
the notes and source changelog. If build scripts, Node requirements, env settings,
discovery or hosting procedure change, update this skill in the **same change**.
