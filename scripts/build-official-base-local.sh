#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="${OPENWRT_LOCAL_CACHE:-${HOME}/cache}"
ARTIFACT_ROOT="${OPENWRT_LOCAL_ARTIFACTS:-${HOME}/artifacts}"

OPENWRT_REVISION="r35346-e9aa5bea9f"
BASE_URL="https://downloads.openwrt.org/snapshots/targets/mediatek/filogic"
IMAGEBUILDER_FILE="openwrt-imagebuilder-mediatek-filogic.Linux-x86_64.tar.zst"
IMAGEBUILDER_SHA256="29fa3b8bfd15eb08c27e5f8153e1a8077e2f19906738289e27497004c40c270a"

DOWNLOAD_DIR="${CACHE_ROOT}/downloads"
IMAGEBUILDER_DIR="${CACHE_ROOT}/imagebuilder/${IMAGEBUILDER_SHA256}"
ARCHIVE="${DOWNLOAD_DIR}/${IMAGEBUILDER_FILE}"
FINAL_DIR="${ARTIFACT_ROOT}/H5000M-official-base-${OPENWRT_REVISION}"
TEMP_DIR="${ARTIFACT_ROOT}/.H5000M-official-base-${OPENWRT_REVISION}.tmp"
LOCK_FILE="${CACHE_ROOT}/.official-base.lock"

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
    "${BASE_URL}/${IMAGEBUILDER_FILE}" \
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

packages="$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' \
  "${ROOT_DIR}/configs/official-base.packages" | tr '\n' ' ')"

rm -rf \
  "${IMAGEBUILDER_DIR}/tmp" \
  "${IMAGEBUILDER_DIR}/build_dir/target-aarch64_cortex-a53_musl/root-mediatek" \
  "${IMAGEBUILDER_DIR}/bin/targets/mediatek/filogic"
make -C "${IMAGEBUILDER_DIR}" image \
  PROFILE=hiveton_h5000m \
  PACKAGES="${packages}" \
  FILES="${ROOT_DIR}/official-base-files"

rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

target_dir="${IMAGEBUILDER_DIR}/bin/targets/mediatek/filogic"
sysupgrade="${target_dir}/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin"
test -s "${sysupgrade}"

cp "${sysupgrade}" "${TEMP_DIR}/"
cp "${target_dir}/profiles.json" "${TEMP_DIR}/"
cp "${ROOT_DIR}/configs/official-base.packages" "${TEMP_DIR}/"
make -C "${IMAGEBUILDER_DIR}" manifest \
  PROFILE=hiveton_h5000m \
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
grep -Eq '^-rw-r--r-- .*squashfs-root/www/index.html$' "${root_listing}"
base_defaults="$(unsquashfs -cat "${root_image}" etc/uci-defaults/90-h5000m-base)"
grep -q "192.168.10.1" <<<"${base_defaults}"
grep -q "redirect_https='1'" <<<"${base_defaults}"
grep -q "PasswordAuth='off'" <<<"${base_defaults}"
grep -q "RootPasswordAuth='off'" <<<"${base_defaults}"
grep -q '/etc/init.d/ttyd disable' <<<"${base_defaults}"

for package in luci luci-ssl luci-i18n-base-zh-cn luci-app-package-manager curl htop; do
  grep -Eq "^${package}[[:space:]]" "${TEMP_DIR}/installed-package-manifest.txt"
done

if grep -Eq '^(h5000m-fancontrol|luci-app-h5000m-fancontrol|luci-app-h5000m-netmode|luci-app-mt5700m|qmodem)[[:space:]]' \
  "${TEMP_DIR}/installed-package-manifest.txt"; then
  echo "Custom plugin leaked into the official base firmware." >&2
  exit 1
fi

grep -q '"version_code":"r35346-e9aa5bea9f"' "${TEMP_DIR}/profiles.json"
(cd "${TEMP_DIR}" && sha256sum openwrt-* > SHA256SUMS)

rm -rf "${FINAL_DIR}"
mv "${TEMP_DIR}" "${FINAL_DIR}"
echo "Build completed: ${FINAL_DIR}"
cat "${FINAL_DIR}/SHA256SUMS"
