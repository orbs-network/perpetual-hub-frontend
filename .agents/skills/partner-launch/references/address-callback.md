# Submit the published website address

Read after the stable production address has been verified. This procedure
submits launch metadata through the official onboarding integration; it does not
send a team message or grant trading activation.

Only submit when the official brief/integration explicitly identifies the
write-capable callback and authorizes sending the published address. A field
named `status URL`, an ordinary portal page, or a registry-check URL is not by
itself a write contract. Do not guess a POST endpoint, reuse a localhost registry
placeholder, modify a read-only status URL or discover a destination by probing.

The documented contract must specify the endpoint, HTTP method, required fields,
authentication mechanism and success/acknowledgement criteria. Use the existing
authorized session/credential mechanism; never request credentials in chat or
put them in source, public build variables or deployment notes. Without a usable
contract/authentication, record submission as **not configured** or **blocked**;
continue the otherwise-authorized publication and provide one real manual route
in the handoff if supplied.

Send only documented metadata, preserving the exact partner ID and the verified
stable HTTPS site address. Use a deploy ID or canonical origin only if required
by the contract; do not substitute a draft URL or invent fields. Keep build
files, local environment values, wallet keys and browser/session data out of the
payload. Send credentials only to their intended service, never across a
cross-origin redirect.

Verify the documented acknowledgement before reporting **address submitted**.
Use documented timeout/retry/idempotency rules. If absent, make one attempt with
a 15-second timeout and do not blindly retry a possibly accepted write. Record
pending, confirmed or failed status, the timestamp and non-sensitive response
reference in `DEPLOYMENT.md`. A failure, timeout, expired session or missing
contract is separate from website publication and must not be called activation.
Reconcile an ambiguous submission before resending; keep the published site and
stable URL rather than creating another hosting project.

On updates, submit a changed published address when the documented contract
requires it. If the address is unchanged, avoid duplicate registration unless
the integration explicitly requires an update. Callback acceptance is evidence
of submission only; hosted REST/WebSocket access and team activation still need
their independent checks.
