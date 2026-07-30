#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/configs/integrated-daed.env"
SEED="${ROOT_DIR}/configs/integrated-daed.seed"
PATCH="${ROOT_DIR}/configs/daed-package.patch"
RUNTIME_PATCH="${ROOT_DIR}/configs/daed-runtime.patch"
REPRO_PATCH="${ROOT_DIR}/configs/daed-reproducible.patch"
LAYOUT_PATCH="${ROOT_DIR}/configs/daed-source-layout.patch"
FAN_PATCH="${ROOT_DIR}/configs/h5000m-fan-cooling-map.patch"
DASHBOARD_PATCH="${ROOT_DIR}/configs/luci-app-daed-dashboard.patch"
WEB_DEFAULTS_PATCH="${ROOT_DIR}/configs/daed-web-defaults.patch"
RUNTIME_OPT_PATCH="${ROOT_DIR}/configs/daed-runtime-optimizations.patch"
MARKER="${ROOT_DIR}/integrated-daed-files/etc/h5000m-daed-build"

for file in "${ENV_FILE}" "${SEED}" "${PATCH}" "${RUNTIME_PATCH}" \
	"${REPRO_PATCH}" "${LAYOUT_PATCH}" "${FAN_PATCH}" "${DASHBOARD_PATCH}" \
	"${WEB_DEFAULTS_PATCH}" "${RUNTIME_OPT_PATCH}" "${MARKER}" \
	"${ROOT_DIR}/docs/DAED-INTEGRATED.md"; do
	[ -s "${file}" ] || {
		echo "Missing daed integration file: ${file}" >&2
		exit 1
	}
done

# shellcheck source=/dev/null
source "${ENV_FILE}"

[[ "${OPENWRT_COMMIT}" =~ ^[0-9a-f]{40}$ ]]
[ "${OPENWRT_REVISION}" = r35346-e9aa5bea9f ]
[ "${DAED_VERSION}" = 2026.07.17-r3 ]

for option in \
	CONFIG_TARGET_mediatek_filogic_DEVICE_hiveton_h5000m \
	CONFIG_KERNEL_DEBUG_INFO_BTF \
	CONFIG_KERNEL_CGROUP_BPF \
	CONFIG_KERNEL_BPF_EVENTS \
	CONFIG_KERNEL_XDP_SOCKETS \
	CONFIG_DAED_USE_KERNEL_BTF \
	CONFIG_PACKAGE_daed \
	CONFIG_PACKAGE_h5000m-daed-defaults \
	CONFIG_PACKAGE_daed-geodata-bundle \
	CONFIG_PACKAGE_luci-app-daed-geodata \
	CONFIG_PACKAGE_luci-app-h5000m-fancontrol \
	CONFIG_PACKAGE_luci-app-h5000m-netmode \
	CONFIG_PACKAGE_luci-app-mt5700m; do
	grep -qx "${option}=y" "${SEED}"
done
grep -qx 'CONFIG_BPF_TOOLCHAIN_HOST_PATH="/usr/lib/llvm-14"' "${SEED}"

grep -q '^+    +kmod-veth +daed-geodata-bundle' "${PATCH}"
grep -q '^+.*DAE_LOCATION_ASSET="/usr/share/v2ray"' "${RUNTIME_PATCH}"
grep -q '^+.*npm install -g pnpm@10.24.0' "${REPRO_PATCH}"
! grep -q '^+.*go get -u=patch' "${REPRO_PATCH}"
grep -q '^-.*git clone.*dae-wing' "${LAYOUT_PATCH}"
grep -q '/delete-node/ cpu-active-high' "${FAN_PATCH}"
grep -q '/delete-node/ cpu-active-low' "${FAN_PATCH}"
grep -q '/delete-node/ cpu-passive' "${FAN_PATCH}"
grep -q '^+PKG_RELEASE:=4' "${DASHBOARD_PATCH}"
grep -q '^+++ /dev/null' "${DASHBOARD_PATCH}"
grep -q '^-.*daed restart' "${DASHBOARD_PATCH}"
grep -q '^+.*var url = "http://" + hostname' "${DASHBOARD_PATCH}"
grep -q 'var hostname = window.location.hostname' "${DASHBOARD_PATCH}"
grep -q '^+.*target="_blank"' "${DASHBOARD_PATCH}"
! grep -q '^+.*<iframe' "${DASHBOARD_PATCH}"
grep -q '^+PKG_RELEASE:=3' "${PATCH}"
grep -Fq '+		patch -d $(DAED_BUILD_DIR) -p1 < \' "${PATCH}"
grep -Fq 'h5000m-web-defaults.patch' "${PATCH}"
grep -Fq 'h5000m-runtime-optimizations.patch' "${PATCH}"
grep -Fq '+export const DEFAULT_CHECK_INTERVAL_SECONDS = 60' "${WEB_DEFAULTS_PATCH}"
grep -Fq '+export const DEFAULT_CHECK_TOLERANCE_MS = 50' "${WEB_DEFAULTS_PATCH}"
grep -Fq '+export const DEFAULT_DISABLE_WAITING_NETWORK = true' "${WEB_DEFAULTS_PATCH}"
grep -Fq "+dip(224.0.0.0/3, 'ff00::/8') -> direct" "${WEB_DEFAULTS_PATCH}"
grep -Fq '+    qtype(https) -> reject' "${WEB_DEFAULTS_PATCH}"
grep -Fq '+const Timeout = 5 * time.Second' "${RUNTIME_OPT_PATCH}"
grep -Fq 'delete from group_nodes where node_id in ?' "${RUNTIME_OPT_PATCH}"
grep -qx "openwrt_revision=${OPENWRT_REVISION}" "${MARKER}"
grep -qx "kernel_abi=${KERNEL_ABI}" "${MARKER}"
grep -qx "daed_package=${DAED_VERSION}" "${MARKER}"
grep -qx "luci_daed=${LUCI_DAED_VERSION}" "${MARKER}"
grep -qx "daed_defaults=${DAED_DEFAULTS_VERSION}" "${MARKER}"
grep -qx "geodata_manager=${GEODATA_MANAGER_VERSION}" "${MARKER}"
grep -qx "mt5700m_manager=${MT5700M_MANAGER_VERSION}" "${MARKER}"
grep -qx "v2fly_geoip=${V2FLY_GEOIP_VERSION}" "${MARKER}"
grep -qx "v2fly_geosite=${V2FLY_GEOSITE_VERSION}" "${MARKER}"
grep -qx "loyalsoldier_geoip=${LOYALSOLDIER_VERSION}" "${MARKER}"
grep -qx "loyalsoldier_geosite=${LOYALSOLDIER_VERSION}" "${MARKER}"

if grep -Eq '^CONFIG_PACKAGE_(luci-app-passwall2|xray-core|sing-box|homeproxy|momo|nikki|podkop)=y$' \
	"${SEED}"; then
	echo "An excluded proxy package is enabled in the daed profile." >&2
	exit 1
fi

for scheme in vless vmess trojan; do
	if grep -RIE "${scheme}://" \
		"${ROOT_DIR}/configs" \
		"${ROOT_DIR}/docs/DAED-INTEGRATED.md" \
		"${ROOT_DIR}/integrated-daed-files"; then
		echo "Private proxy material must not be included." >&2
		exit 1
	fi
done
if grep -RIE 'BEGIN [A-Z ]*PRIVATE KEY' \
	"${ROOT_DIR}/configs" \
	"${ROOT_DIR}/docs/DAED-INTEGRATED.md" \
	"${ROOT_DIR}/integrated-daed-files"; then
	echo "A private key must not be included." >&2
	exit 1
fi

echo "daed integrated-source checks passed."
