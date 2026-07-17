#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../configs/official-base.env
source "${ROOT_DIR}/configs/official-base.env"

CACHE_ROOT="${OPENWRT_LOCAL_CACHE:-${HOME}/cache}"
ARTIFACT_ROOT="${OPENWRT_LOCAL_ARTIFACTS:-${HOME}/artifacts}"
DOWNLOAD_DIR="${CACHE_ROOT}/downloads"
IMAGEBUILDER_DIR="${CACHE_ROOT}/imagebuilder/${IMAGEBUILDER_SHA256}"
ARCHIVE="${DOWNLOAD_DIR}/${IMAGEBUILDER_FILE}"
FINAL_DIR="${ARTIFACT_ROOT}/H5000M-official-base-${OPENWRT_REVISION}"
TEMP_DIR="${ARTIFACT_ROOT}/.H5000M-official-base-${OPENWRT_REVISION}.tmp"
LOCK_FILE="${CACHE_ROOT}/.official-base.lock"
TARGET_DIR="${IMAGEBUILDER_DIR}/bin/targets/${OPENWRT_TARGET}"

for command in curl flock make sha256sum tar unsquashfs; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Missing required command: ${command}" >&2
    exit 1
  }
done

"${ROOT_DIR}/scripts/check-main-package.sh"

mkdir -p "${DOWNLOAD_DIR}" "$(dirname "${IMAGEBUILDER_DIR}")" "${ARTIFACT_ROOT}"
exec 9>"${LOCK_FILE}"
flock -n 9 || {
  echo "Another official base build is already running." >&2
  exit 1
}

verify_archive() {
  [ -f "${ARCHIVE}" ] && \
    echo "${IMAGEBUILDER_SHA256}  ${ARCHIVE}" | sha256sum -c - >/dev/null 2>&1
}

if ! verify_archive; then
  rm -f "${ARCHIVE}.part"
  curl --fail --location --retry 5 --retry-delay 5 --retry-all-errors \
    "${OPENWRT_BASE_URL}/${IMAGEBUILDER_FILE}" \
    -o "${ARCHIVE}.part"
  mv "${ARCHIVE}.part" "${ARCHIVE}"
  verify_archive
fi

if [ ! -f "${IMAGEBUILDER_DIR}/.h5000m-ready" ]; then
  extract_dir="${IMAGEBUILDER_DIR}.extracting"
  rm -rf "${extract_dir}" "${IMAGEBUILDER_DIR}"
  mkdir -p "${extract_dir}"
  tar --zstd -xf "${ARCHIVE}" -C "${extract_dir}" --strip-components=1
  touch "${extract_dir}/.h5000m-ready"
  mv "${extract_dir}" "${IMAGEBUILDER_DIR}"
fi

actual_revision="$(sed -n 's/^REVISION:=//p' "${IMAGEBUILDER_DIR}/include/version.mk" | head -1)"
[ "${actual_revision}" = "${OPENWRT_REVISION}" ] || {
  echo "ImageBuilder revision ${actual_revision:-unknown} does not match ${OPENWRT_REVISION}." >&2
  exit 1
}

packages="$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' \
  "${ROOT_DIR}/configs/official-base.packages" | tr '\n' ' ')"

rm -rf \
  "${IMAGEBUILDER_DIR}/tmp" \
  "${IMAGEBUILDER_DIR}/build_dir/target-${OPENWRT_ARCH}_musl/root-mediatek" \
  "${TARGET_DIR}"
make -C "${IMAGEBUILDER_DIR}" image \
  PROFILE="${OPENWRT_PROFILE}" \
  PACKAGES="${packages}" \
  FILES="${ROOT_DIR}/official-base-files"

rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

sysupgrade="${TARGET_DIR}/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin"
test -s "${sysupgrade}"

cp "${sysupgrade}" "${TEMP_DIR}/"
cp "${TARGET_DIR}/profiles.json" "${TEMP_DIR}/"
cp "${ROOT_DIR}/configs/official-base.env" "${TEMP_DIR}/"
cp "${ROOT_DIR}/configs/official-base.packages" "${TEMP_DIR}/"
make -C "${IMAGEBUILDER_DIR}" manifest \
  PROFILE="${OPENWRT_PROFILE}" \
  PACKAGES="${packages}" \
  > "${TEMP_DIR}/installed-package-manifest.txt"

verify_dir="$(mktemp -d)"
trap 'rm -rf "${verify_dir}"' EXIT
tar -xf "${TEMP_DIR}/$(basename "${sysupgrade}")" -C "${verify_dir}"
root_image="${verify_dir}/sysupgrade-hiveton_h5000m/root"
root_listing="${verify_dir}/root-listing.txt"
unsquashfs -ll "${root_image}" > "${root_listing}"

grep -Eq '^-rwxr-xr-x .*squashfs-root/etc/uci-defaults/90-h5000m-base$' "${root_listing}"
grep -Eq '^-rw-r--r-- .*squashfs-root/etc/apk/keys/h5000m-plugins.pem$' "${root_listing}"
grep -Eq '^-rwxr-xr-x .*squashfs-root/etc/init.d/uhttpd$' "${root_listing}"
grep -Eq '^-rwxr-xr-x .*squashfs-root/etc/init.d/miniupnpd$' "${root_listing}"
grep -Eq '^-rw-r--r-- .*squashfs-root/www/index.html$' "${root_listing}"

base_defaults="$(unsquashfs -cat "${root_image}" etc/uci-defaults/90-h5000m-base)"
grep -q "192.168.10.1" <<<"${base_defaults}"
grep -q "redirect_https='1'" <<<"${base_defaults}"
grep -q "PasswordAuth='off'" <<<"${base_defaults}"
grep -q "RootPasswordAuth='off'" <<<"${base_defaults}"
grep -q '/etc/init.d/ttyd disable' <<<"${base_defaults}"

required_packages=(
  luci luci-ssl luci-i18n-base-zh-cn luci-app-package-manager
  luci-app-upnp luci-i18n-upnp-zh-cn miniupnpd-nftables
  dnsmasq-full
  kmod-nft-socket kmod-nft-tproxy
  kmod-nf-socket kmod-nf-tproxy kmod-nf-conntrack-netlink
  libnetfilter-conntrack3 libnfnetlink0 libnettle8 libgmp10
  curl htop
)
for package in "${required_packages[@]}"; do
  grep -Eq "^${package}[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt" || {
    echo "Required base package is missing: ${package}" >&2
    exit 1
  }
done

forbidden_packages='h5000m-fancontrol|luci-app-h5000m-fancontrol|luci-app-h5000m-netmode|luci-app-mt5700m|luci-app-mt5700m-traffic|luci-app-passwall|luci-app-passwall2|luci-app-homeproxy|luci-app-mosdns|xray-core|xray-plugin|sing-box|hysteria|hysteria2|tuic-client|naiveproxy|qmodem|ubus-at-daemon|sms-tool_q|at-webserver'
if grep -Eq "^(${forbidden_packages})[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt"; then
  echo "A custom or proxy plugin leaked into the official base firmware." >&2
  grep -E "^(${forbidden_packages})[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt" >&2
  exit 1
fi
if grep -Eq "^dnsmasq[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt"; then
  echo "The compact dnsmasq package must be excluded; use dnsmasq-full." >&2
  exit 1
fi

grep -Eq '^-rwxr-xr-x .*squashfs-root/usr/sbin/dnsmasq$' "${root_listing}"
grep -Eq "squashfs-root/lib/modules/${OPENWRT_KERNEL}/nft_socket\\.ko$" "${root_listing}"
grep -Eq "squashfs-root/lib/modules/${OPENWRT_KERNEL}/nft_tproxy\\.ko$" "${root_listing}"
unsquashfs -cat "${root_image}" usr/sbin/dnsmasq | grep -aFq 'nftset'

installed_db="$(unsquashfs -cat "${root_image}" lib/apk/db/installed)"
grep -q "D:.*kernel=${OPENWRT_KERNEL}~${OPENWRT_KERNEL_ABI}" <<<"${installed_db}"

grep -Fq "\"version_code\":\"${OPENWRT_REVISION}\"" "${TEMP_DIR}/profiles.json"
{
  echo "openwrt_revision=${OPENWRT_REVISION}"
  echo "kernel=${OPENWRT_KERNEL}"
  echo "kernel_abi=${OPENWRT_KERNEL_ABI}"
  echo "imagebuilder_sha256=${IMAGEBUILDER_SHA256}"
  echo "target=${OPENWRT_TARGET}"
  echo "profile=${OPENWRT_PROFILE}"
  echo "architecture=${OPENWRT_ARCH}"
  echo "custom_plugins_included=false"
  echo "passwall2_included=false"
  echo "passwall2_runtime_prerequisites_included=true"
  echo "dnsmasq_full_with_nftset=true"
  echo "nft_socket_tproxy_modules_included=true"
  echo "upnp_included=true"
} > "${TEMP_DIR}/BUILD-INFO.txt"
(cd "${TEMP_DIR}" && sha256sum "$(basename "${sysupgrade}")" > SHA256SUMS)

rm -rf "${FINAL_DIR}"
mv "${TEMP_DIR}" "${FINAL_DIR}"
echo "Build completed: ${FINAL_DIR}"
cat "${FINAL_DIR}/SHA256SUMS"
