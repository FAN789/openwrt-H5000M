#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${1:?usage: build-offline-plugin-repo.sh SDK_DIR BASE_ARTIFACT_DIR [OUTPUT_DIR]}"
BASE_DIR="${2:?usage: build-offline-plugin-repo.sh SDK_DIR BASE_ARTIFACT_DIR [OUTPUT_DIR]}"
OUTPUT_DIR="${3:-${HOME}/artifacts/H5000M-offline-plugin-repo}"
SIGNING_DIR="${H5000M_APK_SIGNING_DIR:-${HOME}/.config/h5000m-apk}"
PRIVATE_KEY="${SIGNING_DIR}/private-key.pem"
PUBLIC_KEY="${SIGNING_DIR}/public-key.pem"
APK="${SDK_DIR}/staging_dir/host/bin/apk"
BASE_IMAGE="${BASE_DIR}/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin"

for file in "${APK}" "${PRIVATE_KEY}" "${PUBLIC_KEY}" "${BASE_IMAGE}"; do
	[ -f "${file}" ] || { echo "Required file is missing: ${file}" >&2; exit 1; }
done

packages=(
	h5000m-fancontrol
	luci-app-h5000m-fancontrol
	luci-app-h5000m-netmode
	luci-app-mt5700m
	luci-i18n-h5000m-fancontrol-zh-cn
	luci-i18n-h5000m-netmode-zh-cn
	luci-i18n-mt5700m-zh-cn
	kmod-mii
	kmod-usb-common
	kmod-usb-core
	kmod-usb-ehci
	kmod-usb-net
	kmod-usb-net-cdc-ether
	kmod-usb-net-cdc-ncm
	kmod-usb-serial
	kmod-usb-serial-option
	kmod-usb-serial-wwan
	kmod-usb-xhci-hcd
	kmod-usb-xhci-mtk
	kmod-usb2
	kmod-usb3
	sms-tool_q
	ubus-at-daemon
)

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT
stage_dir="${work_dir}/repo"
key_dir="${work_dir}/keys"
root_dir="${work_dir}/root"
mkdir -p "${stage_dir}" "${key_dir}"
cp "${PUBLIC_KEY}" "${key_dir}/h5000m-plugins.pem"

package_name() {
	"${APK}" adbdump "$1" 2>/dev/null | sed -n 's/^  name: //p' | head -n 1
}

for package in "${packages[@]}"; do
	matches=()
	while IFS= read -r -d '' candidate; do
		[ "$(package_name "${candidate}")" = "${package}" ] && matches+=("${candidate}")
	done < <(find "${SDK_DIR}/bin" -type f -name "${package}-*.apk" -print0)

	[ "${#matches[@]}" -gt 0 ] || {
		echo "Package artifact not found: ${package}" >&2
		exit 1
	}

	selected="$(printf '%s\n' "${matches[@]}" | sort -V | tail -n 1)"
	cp "${selected}" "${stage_dir}/"
done

"${APK}" --keys-dir "${key_dir}" verify "${stage_dir}"/*.apk
"${APK}" mkndx \
	--allow-untrusted \
	--sign-key "${PRIVATE_KEY}" \
	--description "H5000M offline plugin repository" \
	--output "${stage_dir}/packages.adb" \
	"${stage_dir}"/*.apk

tar -xf "${BASE_IMAGE}" -C "${work_dir}"
unsquashfs -d "${root_dir}" \
	"${work_dir}/sysupgrade-hiveton_h5000m/root" \
	bin etc lib sbin usr >/dev/null
mkdir -p "${root_dir}/tmp" "${root_dir}/var/lock"

"${APK}" \
	--root "${root_dir}" \
	--arch aarch64_cortex-a53 \
	--keys-dir "${root_dir}/etc/apk/keys" \
	--repositories-file /dev/null \
	--repository "${stage_dir}/packages.adb" \
	--no-network \
	--simulate add \
	h5000m-fancontrol \
	luci-app-h5000m-fancontrol \
	luci-app-h5000m-netmode \
	luci-app-mt5700m \
	luci-i18n-h5000m-fancontrol-zh-cn \
	luci-i18n-h5000m-netmode-zh-cn \
	luci-i18n-mt5700m-zh-cn

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"
cp "${stage_dir}"/*.apk "${stage_dir}/packages.adb" "${OUTPUT_DIR}/"
cp "${PUBLIC_KEY}" "${OUTPUT_DIR}/h5000m-plugins.pem"
printf '%s\n' "${packages[@]}" > "${OUTPUT_DIR}/PACKAGE-LIST.txt"
printf '%s\n' \
	'Install from a trusted H5000M official base:' \
	'apk add --repository /path/to/packages.adb h5000m-fancontrol luci-app-h5000m-fancontrol luci-app-h5000m-netmode luci-app-mt5700m luci-i18n-h5000m-fancontrol-zh-cn luci-i18n-h5000m-netmode-zh-cn luci-i18n-mt5700m-zh-cn' \
	> "${OUTPUT_DIR}/INSTALL.txt"
(cd "${OUTPUT_DIR}" && sha256sum *.apk packages.adb h5000m-plugins.pem > SHA256SUMS)

echo "Offline plugin repository completed: ${OUTPUT_DIR}"
echo "Package count: ${#packages[@]}"
