#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"

INCLUDE_QMODEM_ORIGINAL="${INCLUDE_QMODEM_ORIGINAL:-${INCLUDE_QMODEM:-false}}"
INCLUDE_QMODEM_NEXT="${INCLUDE_QMODEM_NEXT:-false}"
INCLUDE_PASSWALL2="${INCLUDE_PASSWALL2:-${INCLUDE_PASSWALL:-false}}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"

cd "${SRC_DIR}"

feed_names() {
  awk '/^src-[a-z]+[[:space:]]+/ { print $2 }' feeds.conf.default
}

install_feed_all() {
  local feed="$1"
  echo "Installing all packages from feed: ${feed}"
  ./scripts/feeds install -a -p "${feed}"
}

install_packages() {
  local feed="$1"
  shift

  [ "$#" -gt 0 ] || return 0

  echo "Installing selected packages from feed: ${feed}: $*"
  ./scripts/feeds install -p "${feed}" "$@"
}

for feed in $(feed_names); do
  case "${feed}" in
    small_package)
      echo "Skipping full install for small_package; selected packages are installed below."
      ;;
    qmodem)
      if [ "${INCLUDE_QMODEM_ORIGINAL}" = "true" ] || [ "${INCLUDE_QMODEM_NEXT}" = "true" ]; then
        install_feed_all "${feed}"
        bash "${ROOT_DIR}/scripts/patch-qmodem-hotplug.sh" "${SRC_DIR}"
      else
        echo "Skipping qmodem feed because QModem is disabled."
      fi
      ;;
    *)
      install_feed_all "${feed}"
      ;;
  esac
done

if [ "${INCLUDE_PASSWALL2}" = "true" ]; then
  install_packages small_package \
    luci-app-passwall2 \
    xray-core \
    sing-box \
    tcping \
    v2ray-geoip \
    v2ray-geosite \
    v2ray-plugin \
    geoview
fi

if [ "${INCLUDE_MOSDNS}" = "true" ]; then
  install_packages small_package luci-app-mosdns mosdns v2dat geoview
fi

if [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  install_packages small_package luci-app-homeproxy sing-box
fi
