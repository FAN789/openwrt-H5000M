#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"
CONFIG_FILE="${SRC_DIR}/.config"

INCLUDE_QMODEM_ORIGINAL="${INCLUDE_QMODEM_ORIGINAL:-${INCLUDE_QMODEM:-false}}"
INCLUDE_QMODEM_NEXT="${INCLUDE_QMODEM_NEXT:-false}"
INCLUDE_PASSWALL2="${INCLUDE_PASSWALL2:-${INCLUDE_PASSWALL:-false}}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_UPNP="${INCLUDE_UPNP:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"
INCLUDE_VNSTAT="${INCLUDE_VNSTAT:-false}"
INCLUDE_MT5700M="${INCLUDE_MT5700M:-false}"

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
    echo "提示：${symbol}=y 未进入最终配置，可能是当前 feed 未生成独立包或被依赖关系合并。"
  fi
}

reject_config() {
  local symbol="$1"

  if grep -qx "${symbol}=y" "${CONFIG_FILE}"; then
    echo "冲突：${symbol}=y 不应开启"
    missing=1
  else
    echo "已确认：${symbol} 未开启"
  fi
}

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "未找到 OpenWrt 配置文件：${CONFIG_FILE}"
  exit 1
fi

echo "检查 defconfig 后的最终勾选项"

reject_config "CONFIG_DEVEL"
reject_config "CONFIG_TOOLCHAINOPTS"
reject_config "CONFIG_CCACHE"
reject_config "CONFIG_GDB"
reject_config "CONFIG_GDB_PYTHON"

optional_config "CONFIG_PACKAGE_luci"
optional_config "CONFIG_PACKAGE_luci-ssl"
require_config "CONFIG_PACKAGE_luci-base"
require_config "CONFIG_PACKAGE_luci-light"
require_config "CONFIG_PACKAGE_luci-mod-admin-full"
require_config "CONFIG_PACKAGE_luci-mod-status"
require_config "CONFIG_PACKAGE_luci-mod-system"
require_config "CONFIG_PACKAGE_luci-mod-network"
require_config "CONFIG_PACKAGE_luci-theme-bootstrap"
require_config "CONFIG_PACKAGE_luci-app-firewall"
require_config "CONFIG_PACKAGE_luci-app-ttyd"
require_config "CONFIG_PACKAGE_ttyd"
require_config "CONFIG_PACKAGE_rpcd-mod-luci"
require_config "CONFIG_PACKAGE_rpcd-mod-rrdns"
require_config "CONFIG_PACKAGE_uhttpd"
require_config "CONFIG_PACKAGE_luci-proto-ipv6"
require_config "CONFIG_PACKAGE_luci-proto-ppp"
optional_config "CONFIG_PACKAGE_luci-app-package-manager"
optional_config "CONFIG_PACKAGE_luci-i18n-base-zh-cn"
optional_config "CONFIG_PACKAGE_luci-i18n-firewall-zh-cn"
optional_config "CONFIG_PACKAGE_luci-i18n-package-manager-zh-cn"
optional_config "CONFIG_PACKAGE_luci-i18n-ttyd-zh-cn"
require_config "CONFIG_PACKAGE_luci-app-h5000m-fancontrol"
require_config "CONFIG_PACKAGE_luci-app-h5000m-netmode"

if [ "${INCLUDE_MT5700M}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-mt5700m"
  optional_config "CONFIG_PACKAGE_luci-i18n-mt5700m-zh-cn"
fi

if [ "${INCLUDE_QMODEM_ORIGINAL}" = "true" ] && [ "${INCLUDE_QMODEM_NEXT}" = "true" ]; then
  echo "冲突：QModem 原版和 QModem Next 只能二选一。"
  missing=1
fi

if [ "${INCLUDE_QMODEM_ORIGINAL}" = "true" ]; then
  require_config "CONFIG_PACKAGE_qmodem"
  require_config "CONFIG_PACKAGE_luci-app-qmodem"
  optional_config "CONFIG_PACKAGE_luci-i18n-qmodem-zh-cn"
  reject_config "CONFIG_PACKAGE_luci-app-qmodem-next"
  reject_config "CONFIG_PACKAGE_luci-app-qmodem-monitor"
  reject_config "CONFIG_PACKAGE_luci-app-qmodem-ttlfw4"
  require_config "CONFIG_PACKAGE_modem_scan"
  require_config "CONFIG_PACKAGE_ubus-at-daemon"
  require_config "CONFIG_PACKAGE_tom_modem"
  require_config "CONFIG_PACKAGE_sms-tool_q"
  require_config "CONFIG_PACKAGE_qfirehose"
  require_config "CONFIG_PACKAGE_ndisc6"
  require_config "CONFIG_PACKAGE_quectel-CM-5G-M"
  require_config "CONFIG_PACKAGE_kmod-pcie_mhi"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_q"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_f"
  require_config "CONFIG_PACKAGE_kmod-qmi_wwan_s"
fi

if [ "${INCLUDE_QMODEM_NEXT}" = "true" ]; then
  require_config "CONFIG_PACKAGE_qmodem"
  reject_config "CONFIG_PACKAGE_luci-app-qmodem"
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

if [ "${INCLUDE_PASSWALL2}" = "true" ]; then
  reject_config "CONFIG_PACKAGE_luci-app-passwall"
  require_config "CONFIG_PACKAGE_luci-app-passwall2"
  require_config "CONFIG_PACKAGE_luci-app-passwall2_Nftables_Transparent_Proxy"
  require_config "CONFIG_PACKAGE_luci-app-passwall2_Basic_Core_All"
  require_config "CONFIG_PACKAGE_xray-core"
  require_config "CONFIG_PACKAGE_sing-box"
  require_config "CONFIG_PACKAGE_tcping"
  require_config "CONFIG_PACKAGE_v2ray-geoip"
  require_config "CONFIG_PACKAGE_v2ray-geosite"
  require_config "CONFIG_PACKAGE_v2ray-plugin"
  require_config "CONFIG_PACKAGE_geoview"
  require_config "CONFIG_PACKAGE_kmod-nft-socket"
  require_config "CONFIG_PACKAGE_kmod-nft-tproxy"
  require_config "CONFIG_PACKAGE_kmod-nft-nat"
  require_config "CONFIG_PACKAGE_kmod-inet-diag"
  require_config "CONFIG_PACKAGE_kmod-netlink-diag"
  require_config "CONFIG_PACKAGE_kmod-tun"
fi

if [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-homeproxy"
fi

if [ "${INCLUDE_MOSDNS}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-mosdns"
fi

if [ "${INCLUDE_VNSTAT}" = "true" ]; then
  require_config "CONFIG_PACKAGE_luci-app-vnstat2"
  optional_config "CONFIG_PACKAGE_luci-i18n-vnstat2-zh-cn"
  require_config "CONFIG_PACKAGE_vnstat2"
  require_config "CONFIG_PACKAGE_vnstati2"
fi

if [ "${missing}" -ne 0 ]; then
  echo "有关键软件包没有进入最终配置，请查看上面的缺失项。"
  exit 1
fi

echo "所有关键功能均已进入最终配置。"
