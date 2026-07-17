#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_FILE="${ROOT_DIR}/configs/official-base.packages"
BASE_ENV="${ROOT_DIR}/configs/official-base.env"

required_paths=(
  .github/workflows/build.yml
  configs/official-base.env
  configs/official-base.packages
  official-base-files/etc/apk/keys/h5000m-plugins.pem
  official-base-files/etc/uci-defaults/90-h5000m-base
  scripts/build-official-base-local.sh
)
for path in "${required_paths[@]}"; do
  [ -f "${ROOT_DIR}/${path}" ] || {
    echo "Missing required main-package file: ${path}" >&2
    exit 1
  }
done

for directory in files packages patches; do
  if [ -d "${ROOT_DIR}/${directory}" ] && \
     find "${ROOT_DIR}/${directory}" \( -type f -o -type l \) -print -quit | grep -q .; then
    echo "Legacy custom source files must not exist in the main package: ${directory}" >&2
    exit 1
  fi
done

# shellcheck source=../configs/official-base.env
source "${BASE_ENV}"
[[ "${OPENWRT_REVISION}" =~ ^r[0-9]+-[0-9a-f]+$ ]]
[[ "${IMAGEBUILDER_SHA256}" =~ ^[0-9a-f]{64}$ ]]
[ "${OPENWRT_PROFILE}" = "hiveton_h5000m" ]
[ "${OPENWRT_TARGET}" = "mediatek/filogic" ]
[ "${OPENWRT_ARCH}" = "aarch64_cortex-a53" ]

package_lines() {
  sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "${PACKAGE_FILE}"
}

duplicates="$(package_lines | sort | uniq -d)"
[ -z "${duplicates}" ] || {
  echo "Duplicate entries in official-base.packages:" >&2
  echo "${duplicates}" >&2
  exit 1
}

has_package() {
  local expected="$1"
  package_lines | grep -Fx -- "${expected}" >/dev/null
}

required_packages=(
  luci luci-ssl luci-i18n-base-zh-cn
  luci-app-package-manager luci-app-upnp luci-i18n-upnp-zh-cn
  miniupnpd-nftables
)
for package in "${required_packages[@]}"; do
  has_package "${package}" || {
    echo "Required package is absent from the main-package list: ${package}" >&2
    exit 1
  }
done

forbidden_packages=(
  h5000m-fancontrol luci-app-h5000m-fancontrol luci-app-h5000m-netmode
  luci-app-mt5700m luci-app-mt5700m-traffic
  luci-app-passwall luci-app-passwall2 luci-app-homeproxy luci-app-mosdns
  qmodem ubus-at-daemon sms-tool_q at-webserver
)
for package in "${forbidden_packages[@]}"; do
  if has_package "${package}"; then
    echo "Custom or proxy package is forbidden in the main package: ${package}" >&2
    exit 1
  fi
done

bash -n "${ROOT_DIR}/scripts/build-official-base-local.sh"
sh -n "${ROOT_DIR}/official-base-files/etc/uci-defaults/90-h5000m-base"
openssl pkey -pubin \
  -in "${ROOT_DIR}/official-base-files/etc/apk/keys/h5000m-plugins.pem" \
  -noout >/dev/null

privacy_regex='(vless://|vmess://|trojan://|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
privacy_leak=0
while IFS= read -r path; do
  case "${path}" in
    "${ROOT_DIR}/scripts/check-main-package.sh") continue ;;
  esac
  if grep -nEI "${privacy_regex}" "${path}"; then
    privacy_leak=1
  fi
done < <(find "${ROOT_DIR}" \
  -path "${ROOT_DIR}/.git" -prune -o \
  -path "${ROOT_DIR}/.codex-remote-attachments" -prune -o \
  -path "${ROOT_DIR}/.work" -prune -o \
  -path "${ROOT_DIR}/artifacts" -prune -o \
  -path "${ROOT_DIR}/codex-thread-data" -prune -o \
  -path "${ROOT_DIR}/logs" -prune -o \
  -path "${ROOT_DIR}/outputs" -prune -o \
  -path '*/__pycache__' -prune -o \
  -type f -print)
if [ "${privacy_leak}" -ne 0 ]; then
  echo "Private proxy material or a private key is forbidden in the main repository." >&2
  exit 1
fi

if git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "${ROOT_DIR}" diff --check
fi
echo "Main-package boundary check passed."
