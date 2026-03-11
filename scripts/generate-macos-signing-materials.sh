#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${1:-$PROJECT_ROOT/certs/macos}"
COMMON_NAME="${2:-AI Desk Pet Developer ID Request}"
KEY_FILE="$OUTPUT_DIR/developer-id.key.pem"
CSR_FILE="$OUTPUT_DIR/developer-id.csr.pem"
OPENSSL_CONFIG="$OUTPUT_DIR/developer-id-openssl.cnf"

mkdir -p "$OUTPUT_DIR"

cat > "$OPENSSL_CONFIG" <<CONFIG
[ req ]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn

[ dn ]
CN = $COMMON_NAME
O = AI Desk Pet
OU = Desktop Release
CONFIG

openssl genrsa -out "$KEY_FILE" 2048 >/dev/null 2>&1
openssl req -new -key "$KEY_FILE" -out "$CSR_FILE" -config "$OPENSSL_CONFIG" >/dev/null 2>&1
chmod 600 "$KEY_FILE"

cat <<RESULT
macOS signing materials generated:
- Private key: $KEY_FILE
- CSR: $CSR_FILE
- OpenSSL config: $OPENSSL_CONFIG

Next steps:
1. Log in to Apple Developer and create a "Developer ID Application" certificate with the CSR.
2. Download the certificate and export a .p12 file from Keychain Access.
3. Set CSC_LINK and CSC_KEY_PASSWORD in GitHub Actions secrets.
4. Set notarization secrets and run the release workflow on a v* tag.
RESULT
