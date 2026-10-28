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
grep -Fq '192.168.1.1|192.168.1.1/24)' "${DEFAULTS}"
grep -Fq "uci -q add_list network.lan.ipaddr='192.168.10.1/24'" "${DEFAULTS}"
grep -Fq 'uci -q delete network.lan.netmask' "${DEFAULTS}"

echo 'base product safety checks passed'
