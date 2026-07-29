#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULTS="${ROOT}/official-base-files/etc/uci-defaults/90-h5000m-base"
KEEP="${ROOT}/official-base-files/lib/upgrade/keep.d/h5000m-base"

grep -q "MARKER='/etc/h5000m-defaults-applied'" "${DEFAULTS}"
grep -q 'touch "${MARKER}"' "${DEFAULTS}"
grep -qx '/etc/h5000m-defaults-applied' "${KEEP}"
grep -q 'root_hash=' "${DEFAULTS}"
grep -q 'configure_wifi=0' "${DEFAULTS}"
grep -q 'custom_wifi=0' "${DEFAULTS}"
grep -q "\\[ \"\\\${custom_wifi}\" = '0' \\] || configure_wifi=0" "${DEFAULTS}"

for repo in \
	"${ROOT}/../luci-app-mt5700m/luci-app-mt5700m" \
	"${ROOT}/../luci-app-h5000m-fancontrol" \
	"${ROOT}/../luci-app-h5000m-netmode" \
	"${ROOT}/../luci-app-daed-geodata"; do
	acl="$(find "${repo}/root/usr/share/rpcd/acl.d" -type f -name '*.json' -print -quit)"
	jq -e . "${acl}" >/dev/null
done

! jq -e '.[].read.file["/usr/sbin/mt5700m-at"]' \
	"${ROOT}/../luci-app-mt5700m/luci-app-mt5700m/root/usr/share/rpcd/acl.d/luci-app-mt5700m.json" >/dev/null
! jq -e '.[].read.file["/usr/sbin/h5000m-fancontrol"]' \
	"${ROOT}/../luci-app-h5000m-fancontrol/root/usr/share/rpcd/acl.d/luci-app-h5000m-fancontrol.json" >/dev/null
! jq -e '.[].read.file["/usr/sbin/h5000m-netmode"]' \
	"${ROOT}/../luci-app-h5000m-netmode/root/usr/share/rpcd/acl.d/luci-app-h5000m-netmode.json" >/dev/null
! jq -e '.[].read.file["/usr/sbin/daed-geodata-update"]' \
	"${ROOT}/../luci-app-daed-geodata/root/usr/share/rpcd/acl.d/luci-app-daed-geodata.json" >/dev/null

echo 'product safety checks passed'
