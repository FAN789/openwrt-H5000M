#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${1:?usage: configure-official-sdk.sh SDK_DIR}"

if [ ! -f "${SDK_DIR}/Config.in" ] || [ ! -f "${SDK_DIR}/Config-build.in" ]; then
	echo "Invalid OpenWrt SDK directory: ${SDK_DIR}" >&2
	exit 1
fi

SIGNING_DIR="${H5000M_APK_SIGNING_DIR:-${HOME}/.config/h5000m-apk}"
SIGNING_PRIVATE="${SIGNING_DIR}/private-key.pem"
SIGNING_PUBLIC="${SIGNING_DIR}/public-key.pem"

if [ -f "${SIGNING_PRIVATE}" ] && [ -f "${SIGNING_PUBLIC}" ]; then
	cp "${SIGNING_PRIVATE}" "${SDK_DIR}/private-key.pem"
	cp "${SIGNING_PUBLIC}" "${SDK_DIR}/public-key.pem"
	chmod 0600 "${SDK_DIR}/private-key.pem"
	chmod 0644 "${SDK_DIR}/public-key.pem"
	echo "Using persistent H5000M APK signing key: ${SIGNING_PUBLIC}"
elif [ "${H5000M_ALLOW_EPHEMERAL_SIGNING_KEY:-0}" != "1" ]; then
	echo "Missing persistent H5000M APK signing key in ${SIGNING_DIR}." >&2
	echo "Refusing to create delivery packages with an ephemeral trust key." >&2
	exit 1
else
	echo "Warning: using the SDK ephemeral signing key for a development-only build." >&2
fi

# The official SDK exposes every target profile and package as a module by
# default. Narrow the generated package graph to H5000M so an out-of-tree
# kernel dependency does not package firmware for unrelated devices.
perl -0pi -e \
	's/(config ALL\n\s+bool "Select all userspace packages by default"\n\s+default )y/${1}n/' \
	"${SDK_DIR}/Config.in"

perl -0pi -e \
	's/(config TARGET_MULTI_PROFILE\n\s+bool\n\s+default )y/${1}n/; s/(config TARGET_ALL_PROFILES\n\s+bool\n\s+default )y/${1}n/; s/(config TARGET_DEVICE_mediatek_filogic_DEVICE_[^\n]+\n\s+bool\n\s+default )y/${1}n/g' \
	"${SDK_DIR}/Config-build.in"

# Config-build.in also records every package known when the SDK was produced
# as an invisible module default. Disable those metadata defaults; the source
# package definitions below will select the real dependency closure.
sed -i 's/^[[:space:]]*default m$/\tdefault n/' "${SDK_DIR}/Config-build.in"

rm -rf "${SDK_DIR}/package/h5000m-custom"
mkdir -p "${SDK_DIR}/package/h5000m-custom"
for package in \
	h5000m-fancontrol \
	luci-app-h5000m-fancontrol \
	luci-app-h5000m-netmode \
	luci-app-mt5700m; do
	cp -a "${ROOT_DIR}/packages/${package}" "${SDK_DIR}/package/h5000m-custom/"
done

rm -rf "${SDK_DIR}/tmp"
rm -f "${SDK_DIR}/.config" "${SDK_DIR}/.config.old"
cat > "${SDK_DIR}/.config" <<'EOF'
CONFIG_TARGET_mediatek=y
CONFIG_TARGET_mediatek_filogic=y
# CONFIG_ALL is not set
# CONFIG_ALL_KMODS is not set
# CONFIG_ALL_NONSHARED is not set
CONFIG_PACKAGE_h5000m-fancontrol=m
CONFIG_PACKAGE_luci-app-h5000m-fancontrol=m
CONFIG_PACKAGE_luci-app-h5000m-netmode=m
CONFIG_PACKAGE_luci-app-mt5700m=m
CONFIG_LUCI_LANG_zh_Hans=y
CONFIG_PACKAGE_ubus-at-daemon=m
CONFIG_PACKAGE_sms-tool_q=m
# CONFIG_PACKAGE_luci-app-qmodem is not set
# CONFIG_PACKAGE_luci-app-qmodem-next is not set
# CONFIG_PACKAGE_qmodem is not set
# CONFIG_PACKAGE_modem_scan is not set
# CONFIG_PACKAGE_tom_modem is not set
EOF

make -C "${SDK_DIR}" defconfig

grep -qx '# CONFIG_ALL is not set' "${SDK_DIR}/.config"
grep -qx '# CONFIG_ALL_KMODS is not set' "${SDK_DIR}/.config"
grep -qx '# CONFIG_ALL_NONSHARED is not set' "${SDK_DIR}/.config"
target_count="$(grep -Ec '^CONFIG_TARGET_DEVICE_.*=y$' "${SDK_DIR}/.config" || true)"
if [ "${target_count}" -ne 0 ]; then
	echo "Package-only SDK builds must not select an image profile; found ${target_count}" >&2
	exit 1
fi

for package in \
	h5000m-fancontrol \
	luci-app-h5000m-fancontrol \
	luci-app-h5000m-netmode \
	luci-app-mt5700m \
	ubus-at-daemon \
	sms-tool_q; do
	grep -qx "CONFIG_PACKAGE_${package}=m" "${SDK_DIR}/.config"
done

for package in \
	luci-i18n-h5000m-fancontrol-zh-cn \
	luci-i18n-h5000m-netmode-zh-cn \
	luci-i18n-mt5700m-zh-cn; do
	grep -qx "CONFIG_PACKAGE_${package}=m" "${SDK_DIR}/.config"
done

echo "Configured official SDK for the H5000M plugin set."
