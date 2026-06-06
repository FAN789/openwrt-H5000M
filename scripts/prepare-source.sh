#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/openwrt"
REF="${1:-${OPENWRT_REF:-v25.12.4}}"
REPO_URL="${OPENWRT_REPO:-https://github.com/openwrt/openwrt.git}"

INCLUDE_QMODEM="${INCLUDE_QMODEM:-false}"
INCLUDE_PASSWALL="${INCLUDE_PASSWALL:-false}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_MOSDNS_LUCI="${INCLUDE_MOSDNS_LUCI:-false}"
INCLUDE_UPNP="${INCLUDE_UPNP:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"
INCLUDE_SMALL_PACKAGE="${INCLUDE_SMALL_PACKAGE:-false}"

if [ -d "${SRC_DIR}/.git" ]; then
  echo "更新已有 OpenWrt 官方源码：${REF}"
  git -C "${SRC_DIR}" remote set-url origin "${REPO_URL}"
  git -C "${SRC_DIR}" fetch --tags --depth=1 origin "${REF}"
  git -C "${SRC_DIR}" checkout --detach FETCH_HEAD
else
  echo "克隆 OpenWrt 官方源码：${REF}"
  git clone --depth=1 --branch "${REF}" "${REPO_URL}" "${SRC_DIR}"
fi

echo "应用 H5000M 设备适配"
python3 "${ROOT_DIR}/scripts/apply-h5000m.py" "${SRC_DIR}"

for patch in "${ROOT_DIR}"/patches/optional/*.patch; do
  [ -e "${patch}" ] || continue
  if git -C "${SRC_DIR}" apply --check "${patch}" >/dev/null 2>&1; then
    git -C "${SRC_DIR}" apply "${patch}"
    echo "已应用可选补丁：$(basename "${patch}")"
  else
    echo "跳过不兼容的可选补丁：$(basename "${patch}")"
  fi
done

cp "${ROOT_DIR}/configs/h5000m.seed" "${SRC_DIR}/.config"

append_feed_once() {
  local feed_line="$1"
  local feed_name
  feed_name="$(printf '%s\n' "${feed_line}" | awk '{print $2}')"
  if ! grep -Eq "^src-git[[:space:]]+${feed_name}[[:space:]]" "${SRC_DIR}/feeds.conf.default"; then
    printf '%s\n' "${feed_line}" >> "${SRC_DIR}/feeds.conf.default"
  fi
}

need_small_package=false
if [ "${INCLUDE_PASSWALL}" = "true" ] || \
   [ "${INCLUDE_MOSDNS}" = "true" ] || \
   [ "${INCLUDE_MOSDNS_LUCI}" = "true" ] || \
   [ "${INCLUDE_HOMEPROXY}" = "true" ] || \
   [ "${INCLUDE_SMALL_PACKAGE}" = "true" ]; then
  need_small_package=true
fi

if [ "${INCLUDE_QMODEM}" = "true" ]; then
  echo "添加 QModem 第三方 feed：FUjr/QModem"
  append_feed_once "src-git qmodem https://github.com/FUjr/QModem.git"
fi

if [ "${need_small_package}" = "true" ]; then
  echo "添加 kenzok8/small-package 插件 feed"
  append_feed_once "src-git small_package https://github.com/kenzok8/small-package.git"
fi

echo "写入默认 LAN IP、root 密码、WAN 优先级和软件源清理脚本"
mkdir -p "${SRC_DIR}/files"
cp -a "${ROOT_DIR}/files/." "${SRC_DIR}/files/"

echo "写入 H5000M 自定义软件包"
rm -rf "${SRC_DIR}/package/h5000m-custom"
mkdir -p "${SRC_DIR}/package/h5000m-custom"
cp -a "${ROOT_DIR}/packages/." "${SRC_DIR}/package/h5000m-custom/"

echo "OpenWrt 官方源码已准备完成：${SRC_DIR}"
echo "当前源码版本：${REF}"
echo "后续本地编译步骤："
echo "  cd ${SRC_DIR}"
echo "  ./scripts/feeds update -a"
echo "  ./scripts/feeds install -a"
echo "  INCLUDE_QMODEM=${INCLUDE_QMODEM} INCLUDE_PASSWALL=${INCLUDE_PASSWALL} INCLUDE_MOSDNS=${INCLUDE_MOSDNS} INCLUDE_MOSDNS_LUCI=${INCLUDE_MOSDNS_LUCI} INCLUDE_UPNP=${INCLUDE_UPNP} INCLUDE_HOMEPROXY=${INCLUDE_HOMEPROXY} bash ${ROOT_DIR}/scripts/apply-package-options.sh"
echo "  make defconfig"
echo "  make download -j\$(nproc)"
echo "  make -j\$(nproc)"
