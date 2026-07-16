#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"
CONFIG_FILE="${SRC_DIR}/.config"

INCLUDE_PASSWALL2="${INCLUDE_PASSWALL2:-${INCLUDE_PASSWALL:-false}}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_UPNP="${INCLUDE_UPNP:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"
INCLUDE_VNSTAT="${INCLUDE_VNSTAT:-false}"
INCLUDE_MT5700M="${INCLUDE_MT5700M:-false}"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "未找到 OpenWrt 配置文件：${CONFIG_FILE}"
  exit 1
fi

append_config() {
  cat >> "${CONFIG_FILE}"
}

append_config <<'EOF'
CONFIG_BUILD_LOG=y
CONFIG_LUCI_LANG_zh_Hans=y
CONFIG_PACKAGE_luci-light=y
CONFIG_PACKAGE_luci-mod-admin-full=y
CONFIG_PACKAGE_luci-mod-status=y
CONFIG_PACKAGE_luci-mod-system=y
CONFIG_PACKAGE_luci-mod-network=y
CONFIG_PACKAGE_luci-theme-bootstrap=y
CONFIG_PACKAGE_luci-app-firewall=y
CONFIG_PACKAGE_luci-app-package-manager=y
CONFIG_PACKAGE_luci-app-ttyd=y
CONFIG_PACKAGE_ttyd=y
CONFIG_PACKAGE_luci-proto-ipv6=y
CONFIG_PACKAGE_luci-proto-ppp=y
CONFIG_PACKAGE_rpcd-mod-rrdns=y
CONFIG_PACKAGE_luci-i18n-base-zh-cn=y
CONFIG_PACKAGE_luci-i18n-firewall-zh-cn=y
CONFIG_PACKAGE_luci-i18n-package-manager-zh-cn=y
CONFIG_PACKAGE_luci-i18n-ttyd-zh-cn=y
CONFIG_PACKAGE_luci-i18n-h5000m-fancontrol-zh-cn=y
CONFIG_PACKAGE_luci-i18n-h5000m-netmode-zh-cn=y
EOF

if [ "${INCLUDE_MT5700M}" = "true" ]; then
  echo "启用 MT5700M 原生管理页面"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-mt5700m=y
CONFIG_PACKAGE_luci-i18n-mt5700m-zh-cn=y
EOF
fi

if [ "${INCLUDE_UPNP}" = "true" ]; then
  echo "启用 UPnP"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-upnp=y
CONFIG_PACKAGE_luci-i18n-upnp-zh-cn=y
EOF
fi

if [ "${INCLUDE_PASSWALL2}" = "true" ]; then
  echo "启用 PassWall2"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-passwall2=y
CONFIG_PACKAGE_luci-app-passwall2_Nftables_Transparent_Proxy=y
CONFIG_PACKAGE_luci-app-passwall2_Basic_Core_All=y
CONFIG_PACKAGE_luci-app-passwall2_INCLUDE_V2ray_Plugin=y
CONFIG_PACKAGE_xray-core=y
CONFIG_PACKAGE_sing-box=y
CONFIG_PACKAGE_tcping=y
CONFIG_PACKAGE_v2ray-geoip=y
CONFIG_PACKAGE_v2ray-geosite=y
CONFIG_PACKAGE_v2ray-plugin=y
CONFIG_PACKAGE_geoview=y
CONFIG_PACKAGE_kmod-nft-socket=y
CONFIG_PACKAGE_kmod-nft-tproxy=y
CONFIG_PACKAGE_kmod-nft-nat=y
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

if [ "${INCLUDE_VNSTAT}" = "true" ]; then
  echo "启用 vnStat2"
  append_config <<'EOF'
CONFIG_PACKAGE_luci-app-vnstat2=y
CONFIG_PACKAGE_luci-i18n-vnstat2-zh-cn=y
CONFIG_PACKAGE_vnstat2=y
CONFIG_PACKAGE_vnstati2=y
EOF
fi

echo "软件包勾选配置已写入。"
