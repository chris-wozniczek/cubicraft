#!/usr/bin/env bash
#
# Create a locally-trusted HTTPS certificate for the LAN.
#
# HTTPS matters for multiplayer: browsers obfuscate local IP addresses with
# mDNS names on plain HTTP, and that resolution fails on many home routers.
# Over HTTPS the browser hands out the real address instead.
#
# Requires mkcert:  brew install mkcert   /   choco install mkcert
#                (on Linux: install mkcert and run "mkcert -install")

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS="$DIR/certs"
mkdir -p "$CERTS"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed."
  echo ""
  echo "  macOS:   brew install mkcert"
  echo "  Windows: choco install mkcert"
  echo "  Linux:   see https://github.com/FiloSottile/mkcert"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "Installing the local certificate authority (may ask for your password)…"
mkcert -install

IPS=$(node -e "
const os = require('os');
const out = [];
for (const list of Object.values(os.networkInterfaces())) {
  for (const a of list ?? []) {
    if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
}
console.log(out.join(' '));
")

echo "Creating a certificate for localhost and: $IPS"
mkcert -cert-file "$CERTS/lan.pem" -key-file "$CERTS/lan-key.pem" localhost 127.0.0.1 $IPS

echo ""
echo "Done. Start the launcher with:"
echo "  node tools/launcher.mjs --https --pair-relay"
echo ""
echo "The first time a browser opens the address it will warn about the"
echo "certificate — choose Advanced, then Proceed. The warning appears on"
echo "every laptop that joins."
