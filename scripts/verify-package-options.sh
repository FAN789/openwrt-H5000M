#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"
CONFIG_FILE="${SRC_DIR}/.config"

INCLUDE_QMODEM="${INCLUDE_QMODEM:-false}"
INCLUDE_PASSWALL="${INCLUDE_PASSWALL:-false}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_MOSDNS_LUCI="${INCLUDE_MOSDNS_LUCI:-false}"
INCLUDE_UPNP="${INCLUDE_UPNP:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"

missing=0

require_config() {
  local symbol="$1"
  if grep -qx "${symbol}=y" "${CONFIG_FILE}"; then
    echo "已确认：${symbol}=y"
  else
    echo "缺失：${symbol}=y"
    missing=1
  fi
}

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "未找到 OpenWrt 配置文件：${CONFIG_FILE}"
  exit 1
fi

echo "检查 defconfig 后的最终勾选项"
require_config "CONFIG_PACKAGE_luci-app-h5000m-netmode"

if [ "${INCLUDE_QMODEM}" = "true" ]; then
  require_config "CONFIG_PACKAGE_qmodem"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-next"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-monitor"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-ttlfw4"
  require_config "CONFIG_PACKAGE_qmodem_monitor"
  require_config "CONFIG_PACKAGE_modem_scan"
  require_config "CONFIG_PACKAGE_ubus-at-daemon"
  require_config "CONFIG_PACKAGE_tom_modem"
  require_config "CONFIG_PACKAGE_sms-tool_q"
  require_config "CONFIG_PACKAGE_sms-forwarder-next"
  require_config "CONFIG_PACKAGE_qfirehose"
  require_config "CONFIG_PACKAGE_ndisc6"
  require_config "CONFIG_PACKAGE_quectel-CM-5G-M"
  require_config "CONFIG_PACKAGE_kmod-pcie_mhi"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_q"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_f"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_s"
fi

if [ "${INCLUDE_PASSWALL}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-passwall"
  require_config "CONFIG_PACKAGE_libncurses"
  require_config "CONFIG_PACKAGE_kmod-nft-socket"
  require_config "CONFIG_PACKAGE_kmod-nft-tproxy"
  require_config "CONFIG_PACKAGE_kmod-inet-diag"
  require_config "CONFIG_PACKAGE_kmod-netlink-diag"
  require_config "CONFIG_PACKAGE_kmod-tun"
  require_config "CONFIG_PACKAGE_chinadns-ng"
  require_config "CONFIG_PACKAGE_dns2socks"
  require_config "CONFIG_PACKAGE_ipt2socks"
  require_config "CONFIG_PACKAGE_microsocks"
  require_config "CONFIG_PACKAGE_tcping"
fi

if [ "${INCLUDE_MOSDNS}" = "true" ]; then
  require_config "CONFIG_PACKAGE_mosdns"
fi

if [ "${INCLUDE_MOSDNS_LUCI}" = "true" ]; then
  require_config "CONFIG_PACKAGE_mosdns"
  require_config "CONFIG_PACKAGE_luci-app-mosdns"
  require_config "CONFIG_PACKAGE_v2dat"
  require_config "CONFIG_PACKAGE_v2ray-geoip"
  require_config "CONFIG_PACKAGE_v2ray-geosite"
  require_config "CONFIG_PACKAGE_curl"
fi

if [ "${INCLUDE_UPNP}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-upnp"
fi

if [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-homeproxy"
fi

if [ "${missing}" -ne 0 ]; then
  echo "有勾选的软件包没有进入最终配置，请查看上面的缺失项。"
  exit 1
fi

echo "所有已勾选功能均已进入最终配置。"
