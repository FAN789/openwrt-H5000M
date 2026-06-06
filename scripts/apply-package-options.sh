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

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "未找到 OpenWrt 配置文件：${CONFIG_FILE}"
  exit 1
fi

append_config() {
  cat >> "${CONFIG_FILE}"
}

append_config <<'EOF'
CONFIG_LUCI_LANG_zh_Hans=y
CONFIG_PACKAGE_luci-app-package-manager=y
CONFIG_PACKAGE_luci-app-opkg=y
CONFIG_PACKAGE_luci-i18n-base-zh-cn=y
CONFIG_PACKAGE_luci-i18n-firewall-zh-cn=y
CONFIG_PACKAGE_luci-i18n-package-manager-zh-cn=y
EOF

if [ "${INCLUDE_QMODEM}" = "true" ]; then
  echo "启用 QModem"
  append_config <<'EOF'
CONFIG_PACKAGE_qmodem=y
CONFIG_PACKAGE_luci-app-qmodem-next=y
CONFIG_PACKAGE_luci-app-qmodem-monitor=y
CONFIG_PACKAGE_luci-app-qmodem-ttlfw4=y
CONFIG_PACKAGE_luci-i18n-qmodem-next-zh-cn=y
CONFIG_PACKAGE_luci-i18n-qmodem-monitor-zh-cn=y
CONFIG_PACKAGE_luci-i18n-qmodem-ttlfw4-zh-cn=y
CONFIG_PACKAGE_qmodem_monitor=y
CONFIG_PACKAGE_modem_scan=y
CONFIG_PACKAGE_ubus-at-daemon=y
CONFIG_PACKAGE_tom_modem=y
CONFIG_PACKAGE_sms-tool_q=y
CONFIG_PACKAGE_sms-forwarder-next=y
CONFIG_PACKAGE_qfirehose=y
CONFIG_PACKAGE_ndisc6=y
CONFIG_PACKAGE_quectel-CM-5G-M=y
CONFIG_PACKAGE_kmod-pcie_mhi=y
CONFIG_PACKAGE_kmod-qmi_wwan_q=y
CONFIG_PACKAGE_kmod-qmi_wwan_f=y
CONFIG_PACKAGE_kmod-qmi_wwan_s=y
CONFIG_PACKAGE_luci-app-qmodem_USE_TOM_CUSTOMIZED_QUECTEL_CM=y
# CONFIG_PACKAGE_luci-app-qmodem_USING_QWRT_QUECTEL_CM_5G is not set
# CONFIG_PACKAGE_luci-app-qmodem_GENERIC_MHI_PCIe_DRIVER is not set
# CONFIG_PACKAGE_luci-app-qmodem is not set
# CONFIG_PACKAGE_luci-app-qmodem-sms is not set
# CONFIG_PACKAGE_luci-app-qmodem-ttl is not set
# CONFIG_PACKAGE_luci-app-qmodem-mwan is not set
# CONFIG_PACKAGE_luci-app-qmodem-hc is not set
# CONFIG_PACKAGE_sms-forwarder is not set
EOF
fi

if [ "${INCLUDE_UPNP}" = "true" ]; then
  echo "启用 UPnP"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-upnp=y
CONFIG_PACKAGE_luci-i18n-upnp-zh-cn=y
EOF
fi

if [ "${INCLUDE_PASSWALL}" = "true" ]; then
  echo "启用 PassWall"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-passwall=y
CONFIG_PACKAGE_libncurses=y
CONFIG_PACKAGE_kmod-nft-socket=y
CONFIG_PACKAGE_kmod-nft-tproxy=y
CONFIG_PACKAGE_kmod-inet-diag=y
CONFIG_PACKAGE_kmod-netlink-diag=y
CONFIG_PACKAGE_kmod-tun=y
EOF
fi

if [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  echo "启用 HomeProxy"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-homeproxy=y
EOF
fi

if [ "${INCLUDE_MOSDNS}" = "true" ]; then
  echo "启用 MosDNS"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-mosdns=y
EOF
fi

echo "软件包勾选配置已写入。"
