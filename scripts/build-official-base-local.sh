#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../configs/official-base.env
source "${ROOT_DIR}/configs/official-base.env"

CACHE_ROOT="${OPENWRT_LOCAL_CACHE:-${HOME}/cache}"
ARTIFACT_ROOT="${OPENWRT_LOCAL_ARTIFACTS:-${HOME}/artifacts}"
DOWNLOAD_DIR="${CACHE_ROOT}/downloads"
ARCHIVE="${DOWNLOAD_DIR}/${IMAGEBUILDER_FILE}"
LOCK_FILE="${CACHE_ROOT}/.official-base.lock"

for command in curl flock make sha256sum strings tar unsquashfs python3; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Missing required command: ${command}" >&2
    exit 1
  }
done

# Only the reviewed official release archive is accepted. No moving snapshot,
# scraped hash, or fallback when validation fails.
EXPECTED_IMAGEBUILDER_SHA256="${IMAGEBUILDER_SHA256}"
IMAGEBUILDER_DIR="${CACHE_ROOT}/imagebuilder/${EXPECTED_IMAGEBUILDER_SHA256}"
TARGET_DIR="${IMAGEBUILDER_DIR}/bin/targets/${OPENWRT_TARGET}"

"${ROOT_DIR}/scripts/check-main-package.sh"

mkdir -p "${DOWNLOAD_DIR}" "$(dirname "${IMAGEBUILDER_DIR}")" "${ARTIFACT_ROOT}"
exec 9>"${LOCK_FILE}"
flock -n 9 || {
  echo "Another official base build is already running." >&2
  exit 1
}

verify_archive() {
  [ -f "${ARCHIVE}" ] || return 1
  [ "$(sha256sum "${ARCHIVE}" | awk '{print $1}')" = "${EXPECTED_IMAGEBUILDER_SHA256}" ]
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
  echo "ImageBuilder revision differs from the reviewed stable release." >&2
  exit 1
}
FINAL_DIR="${ARTIFACT_ROOT}/H5000M-official-base-${OPENWRT_VERSION}-${OPENWRT_REVISION}"
TEMP_DIR="${ARTIFACT_ROOT}/.H5000M-official-base-${OPENWRT_VERSION}-${OPENWRT_REVISION}.tmp"
echo "Using official stable OpenWrt ${OPENWRT_VERSION} ${OPENWRT_REVISION}"

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

sysupgrade="${TARGET_DIR}/openwrt-${OPENWRT_VERSION}-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin"
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
grep -Fq '192.168.1.1|192.168.1.1/24)' <<<"${base_defaults}"
grep -Fq "uci -q add_list network.lan.ipaddr='192.168.10.1/24'" <<<"${base_defaults}"
grep -Fq 'uci -q delete network.lan.netmask' <<<"${base_defaults}"
grep -q "redirect_https='1'" <<<"${base_defaults}"
grep -q "PasswordAuth='on'" <<<"${base_defaults}"
grep -q "RootPasswordAuth='on'" <<<"${base_defaults}"
grep -q "echo 'root:root' | chpasswd" <<<"${base_defaults}"
grep -q 'ssid=H5000M' <<<"${base_defaults}"
grep -q 'key=77778888' <<<"${base_defaults}"
grep -q 'htmode=EHT40' <<<"${base_defaults}"
grep -q 'htmode=EHT160' <<<"${base_defaults}"
grep -q 'encryption=sae-mixed' <<<"${base_defaults}"
grep -Fq 'uci -q set "${radio}.disabled=0"' <<<"${base_defaults}"
grep -Fq 'uci -q set "${iface}.disabled=0"' <<<"${base_defaults}"
grep -Fq 'uci -q delete "${iface}.bss_transition"' <<<"${base_defaults}"
if grep -Eq 'uci .*set .*bss_transition' <<<"${base_defaults}"; then
	echo "Unsupported bss_transition setting would prevent the default APs from starting." >&2
	exit 1
fi
grep -q '/etc/init.d/ttyd enable' <<<"${base_defaults}"

required_packages=(
  luci luci-ssl luci-i18n-base-zh-cn luci-app-package-manager
  luci-app-upnp luci-i18n-upnp-zh-cn miniupnpd-nftables
  dnsmasq curl htop
)
for package in "${required_packages[@]}"; do
  grep -Eq "^${package}[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt" || {
    echo "Required base package is missing: ${package}" >&2
    exit 1
  }
done

forbidden_packages="$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "${ROOT_DIR}/configs/forbidden-base.packages" | paste -sd '|' -)"
if grep -Eq "^(${forbidden_packages})[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt"; then
  echo "A custom or proxy plugin leaked into the official base firmware." >&2
  grep -E "^(${forbidden_packages})[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt" >&2
  exit 1
fi
grep -Eq '^-rwxr-xr-x .*squashfs-root/usr/sbin/dnsmasq$' "${root_listing}"
if ! unsquashfs -cat "${root_image}" usr/sbin/dnsmasq | strings | awk 'index($0, " no-nftset ") { found=1 } END { exit !found }'; then
	echo "The base firmware dnsmasq does not advertise the expected no-nftset compact build." >&2
	exit 1
fi

installed_db="$(unsquashfs -cat "${root_image}" lib/apk/db/installed)"
actual_kernel_package="$(printf '%s\n' "${installed_db}" | awk -F: '$1=="P" {p=$2} $1=="V" && p=="kernel" {v=substr($0,3)} END {print v}')"
actual_kernel="${actual_kernel_package%%~*}"
actual_abi="${actual_kernel_package#*~}"
actual_abi="${actual_abi%%-*}"
[ "${actual_kernel}" = "${OPENWRT_KERNEL}" ] && [ "${actual_abi}" = "${OPENWRT_KERNEL_ABI}" ] || {
  echo "Kernel version/ABI does not match the reviewed stable release." >&2
  exit 1
}
release="$(unsquashfs -cat "${root_image}" etc/openwrt_release)"
grep -Fq "DISTRIB_RELEASE='${OPENWRT_VERSION}'" <<<"${release}"
echo "Verified kernel ${OPENWRT_KERNEL} ABI ${OPENWRT_KERNEL_ABI}"
if grep -Eq "squashfs-root/lib/modules/${OPENWRT_KERNEL}/nft_(socket|tproxy)\\.ko$" "${root_listing}"; then
  echo "PassWall2 nft socket/tproxy modules leaked into the base firmware." >&2
  exit 1
fi
python3 - "${TEMP_DIR}/profiles.json" "${OPENWRT_VERSION}" "${OPENWRT_REVISION}" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
assert d['version_number']==sys.argv[2] and d['version_code']==sys.argv[3]
assert 'hiveton_h5000m' in d['profiles']
PY
{
  echo "openwrt_version=${OPENWRT_VERSION}"
  echo "release_channel=stable"
  echo "openwrt_revision=${OPENWRT_REVISION}"
  echo "kernel=${OPENWRT_KERNEL}"
  echo "kernel_abi=${OPENWRT_KERNEL_ABI}"
  echo "imagebuilder_sha256=${EXPECTED_IMAGEBUILDER_SHA256}"
  echo "target=${OPENWRT_TARGET}"
  echo "profile=${OPENWRT_PROFILE}"
  echo "architecture=${OPENWRT_ARCH}"
  echo "custom_plugins_included=false"
  echo "proxy_plugins_included=false"
  echo "daed_included=false"
  echo "passwall2_included=false"
  echo "passwall2_runtime_prerequisites_included=false"
  echo "dnsmasq_variant=compact"
  echo "nft_socket_tproxy_modules_included=false"
  echo "upnp_included=true"
  echo "default_hostname=H5000M"
  echo "default_wifi_ssid=H5000M"
  echo "default_wifi_widths=EHT40,EHT160"
  echo "default_wifi_enabled=true"
  echo "ssh_password_authentication=true"
} > "${TEMP_DIR}/BUILD-INFO.txt"
(cd "${TEMP_DIR}" && find . -maxdepth 1 -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

rm -rf "${FINAL_DIR}"
mv "${TEMP_DIR}" "${FINAL_DIR}"
echo "Build completed: ${FINAL_DIR}"
cat "${FINAL_DIR}/SHA256SUMS"
