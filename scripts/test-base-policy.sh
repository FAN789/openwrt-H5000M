#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "${tmp}"' EXIT
mkdir "${tmp}/repo"
tar -C "${root}" --exclude=.git -cf - . | tar -C "${tmp}/repo" -xf -
check="${tmp}/repo/scripts/check-main-package.sh"
bash "${check}" >/dev/null
cp "${tmp}/repo/configs/official-base.env" "${tmp}/accepted.env"
for version in SNAPSHOT 25.12.6-rc1; do
  sed "s/^OPENWRT_VERSION=.*/OPENWRT_VERSION=${version}/" "${tmp}/accepted.env" > "${tmp}/repo/configs/official-base.env"
  if bash "${check}" > /dev/null 2>&1; then echo 'Invalid release accepted' >&2; exit 1; fi
done
sed 's@^OPENWRT_BASE_URL=.*@OPENWRT_BASE_URL=https://downloads.openwrt.org/snapshots/targets/mediatek/filogic@' "${tmp}/accepted.env" > "${tmp}/repo/configs/official-base.env"
if bash "${check}" >/dev/null 2>&1; then echo 'Snapshot URL accepted' >&2; exit 1; fi
cp "${tmp}/accepted.env" "${tmp}/repo/configs/official-base.env"
for package in daed luci-app-mt5700m mt5700m-transport luci-app-h5000m-fancontrol luci-app-h5000m-netmode; do
  cp "${root}/configs/official-base.packages" "${tmp}/repo/configs/official-base.packages"
  printf '\n%s\n' "${package}" >> "${tmp}/repo/configs/official-base.packages"
  if bash "${check}" >/dev/null 2>&1; then echo 'Plugin package accepted' >&2; exit 1; fi
done
echo 'PASS: stable baseline accepted; snapshot, RC, wrong release URL and custom/proxy packages rejected'
