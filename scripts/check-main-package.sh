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

for directory in files packages patches integrated-daed-files; do
  if [ -d "${ROOT_DIR}/${directory}" ] && \
     find "${ROOT_DIR}/${directory}" \( -type f -o -type l \) -print -quit | grep -q .; then
    echo "Legacy custom source files must not exist in the main package: ${directory}" >&2
    exit 1
  fi
done

# shellcheck source=../configs/official-base.env
source "${BASE_ENV}"
[[ "${OPENWRT_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
[ "${OPENWRT_BASE_URL}" = "https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/mediatek/filogic" ]
[ "${IMAGEBUILDER_FILE}" = "openwrt-imagebuilder-${OPENWRT_VERSION}-mediatek-filogic.Linux-x86_64.tar.zst" ]
[[ "${OPENWRT_REVISION}" =~ ^r[0-9]+-[0-9a-f]+$ ]]
[[ "${IMAGEBUILDER_SHA256}" =~ ^[0-9a-f]{64}$ ]]
[ "${OPENWRT_PROFILE}" = "hiveton_h5000m" ]
[ "${OPENWRT_TARGET}" = "mediatek/filogic" ]
[ "${OPENWRT_ARCH}" = "aarch64_cortex-a53" ]
[[ "${OPENWRT_KERNEL}" =~ ^[0-9]+.[0-9]+.[0-9]+$ ]]
[[ "${OPENWRT_KERNEL_ABI}" =~ ^[0-9a-f]{32}$ ]]

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

mapfile -t forbidden_packages < <(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "${ROOT_DIR}/configs/forbidden-base.packages")
for package in "${forbidden_packages[@]}"; do
  if has_package "${package}"; then
    echo "Plugin-owned package is forbidden in the main package: ${package}" >&2
    exit 1
  fi
done

bash -n "${ROOT_DIR}/scripts/build-official-base-local.sh"
sh -n "${ROOT_DIR}/official-base-files/etc/uci-defaults/90-h5000m-base"
grep -q 'delete network.globals.ula_prefix' \
  "${ROOT_DIR}/official-base-files/etc/uci-defaults/90-h5000m-base"
openssl pkey -pubin \
  -in "${ROOT_DIR}/official-base-files/etc/apk/keys/h5000m-plugins.pem" \
  -noout >/dev/null

privacy_regex='(vless://|vmess://|trojan://|ss://|hysteria2?://|-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|https?://[^[:space:]/]+:[^[:space:]@]+@|Authorization:[[:space:]]*(Basic|Bearer)[[:space:]]+[A-Za-z0-9._~+/-]+)'
privacy_leak=0
while IFS= read -r path; do
  case "${path}" in
    "${ROOT_DIR}/scripts/check-main-package.sh") continue ;;
  esac
  if grep -qEI "${privacy_regex}" "${path}"; then
    echo "Potential credential, private key, or proxy endpoint in: ${path#${ROOT_DIR}/}" >&2
    privacy_leak=1
  fi

  # Public examples use /home/builder. Reject user-specific home directories
  # and Windows profile paths without echoing their potentially private value.
  while IFS= read -r home_path; do
    case "${home_path}" in
      /home/builder) ;;
      *)
        echo "Potential user-specific home path in: ${path#${ROOT_DIR}/}" >&2
        privacy_leak=1
        ;;
    esac
  done < <(grep -Eo '/home/[A-Za-z0-9._-]+' "${path}" | sort -u || true)
  if grep -qE '([A-Za-z]:\\Users\\|\\\\[0-9]{1,3}(\.[0-9]{1,3}){3}\\)' "${path}"; then
    echo "Potential local Windows or network path in: ${path#${ROOT_DIR}/}" >&2
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
