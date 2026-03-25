# Copilot Coding Agent — Firewall Troubleshooting

When the GitHub Copilot coding agent runs inside an Actions appliance, all outbound network traffic is filtered by a built-in firewall. If a required host is not on the allowlist the workflow fails with errors such as:

- `HTTP/2 GOAWAY connection terminated`
- `⚠️ Warning: I tried to connect to the following addresses, but was blocked by firewall rules`
- `Error: Process completed with exit code 1` (during dependency installs or API calls)

## Quick Fix — Add Hosts to the Custom Allowlist

1. In your repository go to **Settings → Copilot → Coding agent**.
2. Under **Custom allowlist**, add every domain or URL the workflow needs (e.g. `registry.npmjs.org`, `api.groq.com`, `generativelanguage.googleapis.com`).
3. Click **Save changes** and keep **Recommended allowlist** enabled unless you have a specific reason to turn it off.
4. Re-run the failed workflow.

Reference: <https://gh.io/copilot/firewall-config>

## Alternative — Run Setup Before the Firewall Is Enabled

If you need packages or credentials to be fetched before the firewall activates, add the commands as **Copilot setup steps**. These steps run in a pre-firewall phase so downloads always succeed.

Reference: <https://gh.io/copilot/actions-setup-steps>

## Useful Links

| Resource | URL |
|---|---|
| Allowlist configuration guide | <https://gh.io/copilot/firewall-config> |
| Copilot setup steps guide | <https://gh.io/copilot/actions-setup-steps> |
