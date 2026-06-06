#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"
CONFIG_FILE="${SRC_DIR}/.config"

INCLUDE_QMODEM="${INCLUDE_QMODEM:-false}"
INCLUDE_PASSWALL="${INCLUDE_PASSWALL:-false}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
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

optional_config() {
  local symbol="$1"

  if grep -qx "${symbol}=y" "${CONFIG_FILE}"; then
    echo "已确认：${symbol}=y"
  else
    echo "提示：${symbol}=y 未进入最终配置，可能是当前 LuCI feed 未生成独立翻译包。"
  fi
}

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "未找到 OpenWrt 配置文件：${CONFIG_FILE}"
  exit 1
fi

echo "检查 defconfig 后的最终勾选项"

require_config "CONFIG_PACKAGE_luci"
require_config "CONFIG_PACKAGE_luci-ssl"
require_config "CONFIG_PACKAGE_luci-base"
require_config "CONFIG_PACKAGE_rpcd-mod-luci"
require_config "CONFIG_PACKAGE_uhttpd"
optional_config "CONFIG_PACKAGE_luci-app-package-manager"
optional_config "CONFIG_PACKAGE_luci-app-opkg"
optional_config "CONFIG_PACKAGE_luci-i18n-base-zh-cn"
optional_config "CONFIG_PACKAGE_luci-i18n-firewall-zh-cn"
optional_config "CONFIG_PACKAGE_luci-i18n-package-manager-zh-cn"
require_config "CONFIG_PACKAGE_luci-app-h5000m-fancontrol"
require_config "CONFIG_PACKAGE_luci-app-h5000m-netmode"

if [ "${INCLUDE_QMODEM}" = "true" ]; then
  require_config "CONFIG_PACKAGE_qmodem"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-next"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-monitor"
  require_config "CONFIG_PACKAGE_luci-app-qmodem-ttlfw4"
  optional_config "CONFIG_PACKAGE_luci-i18n-qmodem-next-zh-cn"
  optional_config "CONFIG_PACKAGE_luci-i18n-qmodem-monitor-zh-cn"
  optional_config "CONFIG_PACKAGE_luci-i18n-qmodem-ttlfw4-zh-cn"
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

if [ "${INCLUDE_UPNP}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-upnp"
  optional_config "CONFIG_PACKAGE_luci-i18n-upnp-zh-cn"
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

if [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-homeproxy"
fi

if [ "${INCLUDE_MOSDNS}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-mosdns"
fi

if [ "${missing}" -ne 0 ]; then
  echo "有关键软件包没有进入最终配置，请查看上面的缺失项。"
  exit 1
fi

echo "所有关键功能均已进入最终配置。"
