#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${OPENWRT_SRC_DIR:-${ROOT_DIR}/openwrt}"
LOCKED_REF="$(tr -d '[:space:]' < "${ROOT_DIR}/configs/openwrt.ref")"
REF="${1:-${OPENWRT_REF:-${LOCKED_REF}}}"
QMODEM_REF="$(tr -d '[:space:]' < "${ROOT_DIR}/configs/qmodem.ref")"
REPO_URL="${OPENWRT_REPO:-https://github.com/openwrt/openwrt.git}"

INCLUDE_PASSWALL2="${INCLUDE_PASSWALL2:-${INCLUDE_PASSWALL:-false}}"
INCLUDE_MOSDNS="${INCLUDE_MOSDNS:-false}"
INCLUDE_UPNP="${INCLUDE_UPNP:-false}"
INCLUDE_HOMEPROXY="${INCLUDE_HOMEPROXY:-false}"
INCLUDE_MT5700M="${INCLUDE_MT5700M:-false}"

git config --global --unset-all http.proxy >/dev/null 2>&1 || true
git config --global --unset-all https.proxy >/dev/null 2>&1 || true
git config --global http.version HTTP/1.1
git config --global http.lowSpeedLimit 0
git config --global http.postBuffer 524288000

if [ -d "${SRC_DIR}/.git" ]; then
  echo "更新已有 OpenWrt 官方源码：${REF}"
  git -C "${SRC_DIR}" remote set-url origin "${REPO_URL}"
  git -C "${SRC_DIR}" reset --hard HEAD
  # Older project versions generated this DTS as an untracked file. Remove only
  # that legacy copy so Git can check out the now-official OpenWrt version while
  # keeping the self-hosted runner's incremental build cache intact. Do not
  # remove the file once it is tracked by the selected official source.
  legacy_dts="target/linux/mediatek/dts/mt7987a-hiveton-h5000m.dts"
  if ! git -C "${SRC_DIR}" ls-files --error-unmatch "${legacy_dts}" >/dev/null 2>&1; then
    rm -f "${SRC_DIR}/${legacy_dts}"
  fi
  if git -C "${SRC_DIR}" rev-parse --verify --quiet "${REF}^{commit}" >/dev/null; then
    git -C "${SRC_DIR}" checkout --detach "${REF}^{commit}"
  elif git -C "${SRC_DIR}" rev-parse --verify --quiet "refs/tags/${REF}^{commit}" >/dev/null; then
    git -C "${SRC_DIR}" checkout --detach "refs/tags/${REF}^{commit}"
  else
    git -C "${SRC_DIR}" fetch --tags --depth=1 origin "${REF}"
    git -C "${SRC_DIR}" checkout --detach FETCH_HEAD
  fi
else
  echo "克隆 OpenWrt 官方源码：${REF}"
  mkdir -p "$(dirname "${SRC_DIR}")"
  git clone --filter=blob:none --no-checkout --depth=1 "${REPO_URL}" "${SRC_DIR}"
  if git -C "${SRC_DIR}" rev-parse --verify --quiet "${REF}^{commit}" >/dev/null; then
    git -C "${SRC_DIR}" checkout --detach "${REF}^{commit}"
  elif git -C "${SRC_DIR}" rev-parse --verify --quiet "refs/tags/${REF}^{commit}" >/dev/null; then
    git -C "${SRC_DIR}" checkout --detach "refs/tags/${REF}^{commit}"
  else
    git -C "${SRC_DIR}" fetch --tags --depth=1 origin "${REF}"
    git -C "${SRC_DIR}" checkout --detach FETCH_HEAD
  fi
fi

if grep -q '^define Device/hiveton_h5000m$' "${SRC_DIR}/target/linux/mediatek/image/filogic.mk" && \
   [ -f "${SRC_DIR}/target/linux/mediatek/dts/mt7987a-hiveton-h5000m.dts" ]; then
  echo "使用 OpenWrt 官方 H5000M 设备支持"
else
  echo "所选 OpenWrt 版本不包含官方 H5000M 设备支持：${REF}"
  echo "请使用 main 或包含提交 6487cc9a1f4caa07486772be851aaed3d155345d 的版本。"
  exit 1
fi

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

# OpenWrt 25.x may carry the optional video feed. H5000M does not use it, and
# GitHub-side TLS interruptions on this feed can fail the whole feed update.
sed -i '/^[[:space:]]*src-git[[:space:]]\+video[[:space:]]/d' "${SRC_DIR}/feeds.conf.default"
sed -i '/^[[:space:]]*src-git[[:space:]]\+mt5700m[[:space:]]/d' "${SRC_DIR}/feeds.conf.default"

append_feed_once() {
  local feed_line="$1"
  local feed_name
  feed_name="$(printf '%s\n' "${feed_line}" | awk '{print $2}')"
  if ! grep -Eq "^src-git[[:space:]]+${feed_name}[[:space:]]" "${SRC_DIR}/feeds.conf.default"; then
    printf '%s\n' "${feed_line}" >> "${SRC_DIR}/feeds.conf.default"
  fi
}

need_small_package=false
if [ "${INCLUDE_PASSWALL2}" = "true" ] || \
   [ "${INCLUDE_MOSDNS}" = "true" ] || \
   [ "${INCLUDE_HOMEPROXY}" = "true" ]; then
  need_small_package=true
fi

if [ "${INCLUDE_MT5700M}" = "true" ]; then
  echo "添加 MT5700M AT/SMS 传输组件 feed：FUjr/QModem"
  append_feed_once "src-git qmodem https://github.com/FUjr/QModem.git^${QMODEM_REF}"
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
[ "${INCLUDE_MT5700M}" = "true" ] || rm -rf "${SRC_DIR}/package/h5000m-custom/luci-app-mt5700m"

echo "OpenWrt 官方源码已准备完成：${SRC_DIR}"
echo "当前源码版本：${REF}"
echo "后续本地编译步骤："
echo "  cd ${SRC_DIR}"
echo "  ./scripts/feeds update -a"
echo "  ./scripts/feeds install -a"
echo "  INCLUDE_MT5700M=${INCLUDE_MT5700M} INCLUDE_PASSWALL2=${INCLUDE_PASSWALL2} INCLUDE_MOSDNS=${INCLUDE_MOSDNS} INCLUDE_UPNP=${INCLUDE_UPNP} INCLUDE_HOMEPROXY=${INCLUDE_HOMEPROXY} bash ${ROOT_DIR}/scripts/apply-package-options.sh"
echo "  make defconfig"
echo "  make download -j\$(nproc)"
echo "  make -j\$(nproc)"
