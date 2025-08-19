# Nix Build & Development

This project ships with a `flake.nix` for reproducible builds & dev shells.

## Requirements
- Nix with flakes enabled (`experimental-features = nix-command flakes`)

## Get a Dev Shell
```bash
nix develop
```
This provides Node.js 20, pnpm, and `npm-check-updates`.

## Build the Package
First run (hash will fail because of fake hash):
```bash
nix build
```
Copy the reported `got: sha256-...` hash and replace `pkgs.lib.fakeSha256` in `flake.nix` with that value.
Then build again:
```bash
nix build
```
Result symlink: `result/` contains the project sources (installed).

## Run via Nix App
```bash
nix run
```
Pass environment variables (Discord token etc.) e.g.:
```bash
DISCORD_TOKEN=xxxx APPLICATION_ID=xxxx GUILD_ID=xxxx STATUS_CHANNEL_ID=xxxx nix run
```
Or create a `.env` file and use `dotenvx` / custom wrapper.

## Updating Dependencies
Inside dev shell:
```bash
npm install <pkg>@latest
rm -f node_modules/.package-lock.json
npm install --package-lock-only
nix hash path ./node_modules > /dev/null # to ensure reproducibility
```
Then update the `npmDepsHash` by re-running `nix build` and replacing fake hash.

## Customization
- Change Node version: edit `nodejs = pkgs.nodejs_20;` in `flake.nix`.
- Add runtime tools: extend `packages = [ ... ];` in `devShells.default`.

## Notes
`ENABLE_SHELL_PING` defaults to false in `.env.example` because `ping` often requires elevated permissions inside containers.
