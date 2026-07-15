#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-openwrt}"
NET_HOTPLUG=""
USB_HOTPLUG=""
QMODEM_NETWORK=""
QMODEM_LED=""
QMODEM_CONTROLLER=""

for candidate in \
  "${SRC_DIR}/package/feeds/qmodem/qmodem/files/etc/hotplug.d/net/20-modem-net" \
  "${SRC_DIR}/feeds/qmodem/application/qmodem/files/etc/hotplug.d/net/20-modem-net" \
  "${SRC_DIR}/feeds/qmodem/qmodem/files/etc/hotplug.d/net/20-modem-net"; do
  if [ -f "${candidate}" ]; then
    NET_HOTPLUG="${candidate}"
    break
  fi
done

for candidate in \
  "${SRC_DIR}/package/feeds/qmodem/luci-app-qmodem/luasrc/controller/qmodem.lua" \
  "${SRC_DIR}/feeds/qmodem/luci/luci-app-qmodem/luasrc/controller/qmodem.lua"; do
  if [ -f "${candidate}" ]; then
    QMODEM_CONTROLLER="${candidate}"
    break
  fi
done

if [ -n "${QMODEM_CONTROLLER}" ] && ! grep -q "H5000M_QMODEM_UNIFIED_MENU_V2" "${QMODEM_CONTROLLER}"; then
  python3 - "${QMODEM_CONTROLLER}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
anchor = '\tentry({"admin", "modem", "qmodem"}, alias("admin", "modem", "qmodem", "modem_info"), luci.i18n.translate("QModem"), 100).dependent = true\n'
v1_anchor = '''\t-- H5000M_QMODEM_UNIFIED_MENU
\t-- Keep the legacy routes available for expert troubleshooting, but avoid a
\t-- second visible modem manager when the unified MT5700M UI is installed.
\tlocal qmodem_root = entry({"admin", "modem", "qmodem"}, alias("admin", "modem", "qmodem", "modem_info"), luci.i18n.translate("QModem"), 100)
\tqmodem_root.dependent = true
\tqmodem_root.hidden = nixio.fs.access("/etc/config/mt5700m")
'''
replacement = '''\t-- H5000M_QMODEM_UNIFIED_MENU_V2
\t-- Keep the legacy routes available for expert troubleshooting, but avoid a
\t-- second visible modem manager when the unified MT5700M UI is installed.
\tlocal qmodem_title = luci.i18n.translate("QModem")
\tif nixio.fs.access("/etc/config/mt5700m") then
\t\tqmodem_title = nil
\tend
\tlocal qmodem_root = entry({"admin", "modem", "qmodem"}, alias("admin", "modem", "qmodem", "modem_info"), qmodem_title, 100)
\tqmodem_root.dependent = true
'''

if v1_anchor in text:
    text = text.replace(v1_anchor, replacement, 1)
elif anchor in text:
    text = text.replace(anchor, replacement, 1)
else:
    raise SystemExit(f"missing QModem menu anchor in {path}")

path.write_text(text, encoding="utf-8")
PY
  echo "Applied QModem unified-menu compatibility patch: ${QMODEM_CONTROLLER}"
else
  echo "Skipped QModem unified-menu compatibility patch: file missing or already patched."
fi

if [ -n "${QMODEM_CONTROLLER}" ] && ! grep -q "H5000M_QMODEM_UNIFIED_MENU_V3" "${QMODEM_CONTROLLER}"; then
  python3 - "${QMODEM_CONTROLLER}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
anchor = '''    if not nixio.fs.access("/etc/config/qmodem") then
        return
    end
'''
insert = '''    -- H5000M_QMODEM_UNIFIED_MENU_V3
    -- The native MT5700M manager replaces the legacy QModem pages. Keep the
    -- old root URL as a compatibility redirect without publishing a menu item.
    if nixio.fs.access("/etc/config/mt5700m") then
        entry({"admin", "modem", "qmodem"}, alias("admin", "modem", "mt5700m", "status"), nil).dependent = false
        return
    end
'''

if anchor not in text:
    raise SystemExit(f"missing QModem index anchor in {path}")

path.write_text(text.replace(anchor, anchor + insert, 1), encoding="utf-8")
PY
  echo "Applied QModem unified-menu redirect patch: ${QMODEM_CONTROLLER}"
else
  echo "Skipped QModem unified-menu redirect patch: file missing or already patched."
fi

if [ -n "${QMODEM_CONTROLLER}" ] && ! grep -q "H5000M_QMODEM_UNIFIED_MENU_V4" "${QMODEM_CONTROLLER}"; then
  python3 - "${QMODEM_CONTROLLER}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
v3 = '''    -- H5000M_QMODEM_UNIFIED_MENU_V3
    -- The native MT5700M manager replaces the legacy QModem pages. Keep the
    -- old root URL as a compatibility redirect without publishing a menu item.
    if nixio.fs.access("/etc/config/mt5700m") then
        entry({"admin", "modem", "qmodem"}, alias("admin", "modem", "mt5700m", "status"), nil).dependent = false
        return
    end
'''
v4 = '''    -- H5000M_QMODEM_UNIFIED_MENU_V4
    -- The native MT5700M manager replaces the legacy QModem pages. The QModem
    -- ubus service remains active; only its duplicate legacy LuCI tree is omitted.
    if nixio.fs.access("/etc/config/mt5700m") then
        return
    end
'''

if v3 not in text:
    raise SystemExit(f"missing QModem V3 menu block in {path}")

path.write_text(text.replace(v3, v4, 1), encoding="utf-8")
PY
  echo "Applied QModem duplicate-menu suppression patch: ${QMODEM_CONTROLLER}"
else
  echo "Skipped QModem duplicate-menu suppression patch: file missing or already patched."
fi

for candidate in \
  "${SRC_DIR}/package/feeds/qmodem/qmodem/files/etc/hotplug.d/usb/20-modem-usb" \
  "${SRC_DIR}/feeds/qmodem/application/qmodem/files/etc/hotplug.d/usb/20-modem-usb" \
  "${SRC_DIR}/feeds/qmodem/qmodem/files/etc/hotplug.d/usb/20-modem-usb"; do
  if [ -f "${candidate}" ]; then
    USB_HOTPLUG="${candidate}"
    break
  fi
done

for candidate in \
  "${SRC_DIR}/package/feeds/qmodem/qmodem/files/etc/init.d/qmodem_network" \
  "${SRC_DIR}/feeds/qmodem/application/qmodem/files/etc/init.d/qmodem_network" \
  "${SRC_DIR}/feeds/qmodem/qmodem/files/etc/init.d/qmodem_network"; do
  if [ -f "${candidate}" ]; then
    QMODEM_NETWORK="${candidate}"
    break
  fi
done

for candidate in \
  "${SRC_DIR}/package/feeds/qmodem/qmodem/files/etc/init.d/qmodem_led" \
  "${SRC_DIR}/feeds/qmodem/application/qmodem/files/etc/init.d/qmodem_led" \
  "${SRC_DIR}/feeds/qmodem/qmodem/files/etc/init.d/qmodem_led"; do
  if [ -f "${candidate}" ]; then
    QMODEM_LED="${candidate}"
    break
  fi
done

if [ -n "${NET_HOTPLUG}" ] && ! grep -q "H5000M_QMODEM_HOTPLUG_FILTER" "${NET_HOTPLUG}"; then
  python3 - "${NET_HOTPLUG}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

anchor = '[ -z "${DEVPATH}" ] && exit\n'
insert = r'''

# H5000M_QMODEM_HOTPLUG_FILTER
# H5000M uses the USB NCM modem at slot 2-1.  WiFi AP interfaces and normal
# Ethernet devices also trigger net hotplug events; do not let QModem scan them
# as PCIe modems.
case "${INTERFACE}" in
    br-lan|lan|wan|wan6|eth0|eth1|hnat|phy*-ap*|phy*.*-ap*|wlan*)
        exit
        ;;
esac

case "${DEVPATH}" in
    */net/br-lan|*/net/eth0|*/net/eth1|*/net/hnat|*/net/phy*-ap*|*/net/phy*.*-ap*|*/net/wlan*)
        exit
        ;;
esac
'''

if anchor not in text:
    raise SystemExit(f"missing hotplug anchor in {path}")

text = text.replace(anchor, anchor + insert, 1)

anchor = '''logger -t modem_hotplug "net slot: ${slot} action: ${ACTION} slot_type: ${slot_type}"
'''
insert = r'''if [ "${slot_type}" = "pcie" ] && [ "$(uci -q get qmodem.main.enable_pcie_scan || echo 0)" != "1" ]; then
    exit
fi

'''

if anchor not in text:
    raise SystemExit(f"missing slot_type anchor in {path}")

text = text.replace(anchor, insert + anchor, 1)
path.write_text(text, encoding="utf-8")
PY
  echo "Applied QModem net hotplug filter: ${NET_HOTPLUG}"
else
  echo "Skipped QModem net hotplug filter: file missing or already patched."
fi

if [ -n "${USB_HOTPLUG}" ] && ! grep -q "H5000M_QMODEM_USB_SLOT_FILTER" "${USB_HOTPLUG}"; then
  python3 - "${USB_HOTPLUG}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

anchor = 'slot=$(basename "${DEVPATH}")\n'
insert = r'''# H5000M_QMODEM_USB_SLOT_FILTER
# Only the built-in 5G module at USB slot 2-1 should be auto-scanned.
case "$(basename "${DEVPATH}")" in
    2-1)
        ;;
    *)
        exit
        ;;
esac

'''

if anchor not in text:
    raise SystemExit(f"missing USB hotplug anchor in {path}")

text = text.replace(anchor, insert + anchor, 1)
path.write_text(text, encoding="utf-8")
PY
  echo "Applied QModem USB slot filter: ${USB_HOTPLUG}"
else
  echo "Skipped QModem USB slot filter: file missing or already patched."
fi

if [ -n "${QMODEM_NETWORK}" ] && ! grep -q "H5000M_QMODEM_SKIP_LED_SERVICE" "${QMODEM_NETWORK}"; then
  python3 - "${QMODEM_NETWORK}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

text = text.replace(
'''start_led_service()
{
    /etc/init.d/qmodem_led start_instance "$1"
    logger -t qmodem_network "Forward start LED event for modem $1"
}
''',
'''start_led_service()
{
    # H5000M_QMODEM_SKIP_LED_SERVICE
    [ -x /etc/init.d/qmodem_led ] || return 0
    [ "$(uci -q get qmodem.main.enable_led_service || echo 0)" = "1" ] || return 0
    /etc/init.d/qmodem_led start_instance "$1" || true
    logger -t qmodem_network "Forward start LED event for modem $1"
}
''',
1,
)

text = text.replace(
'''stop_led_service(){
    /etc/init.d/qmodem_led stop_instance "$1"
    logger -t qmodem_network "Forward stop LED event for modem $1"
}
''',
'''stop_led_service(){
    # H5000M_QMODEM_SKIP_LED_SERVICE
    [ -x /etc/init.d/qmodem_led ] || return 0
    [ "$(uci -q get qmodem.main.enable_led_service || echo 0)" = "1" ] || return 0
    /etc/init.d/qmodem_led stop_instance "$1" || true
    logger -t qmodem_network "Forward stop LED event for modem $1"
}
''',
1,
)

if "H5000M_QMODEM_SKIP_LED_SERVICE" not in text:
    raise SystemExit(f"missing qmodem_network LED anchor in {path}")

path.write_text(text, encoding="utf-8")
PY
  echo "Applied QModem LED service guard: ${QMODEM_NETWORK}"
else
  echo "Skipped QModem LED service guard: file missing or already patched."
fi

if [ -n "${QMODEM_LED}" ] && ! grep -q "H5000M_QMODEM_LED_EMPTY_GUARD" "${QMODEM_LED}"; then
  python3 - "${QMODEM_LED}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

text = text.replace(
'''start_instance()
{
    [ -n "$1" ] || return 1
    config_load qmodem
    procd_kill "$service" "led_$1"
    rc_procd _start_instance "$1"
}
''',
'''start_instance()
{
    # H5000M_QMODEM_LED_EMPTY_GUARD
    local led_script
    [ -n "$1" ] || return 1
    config_load qmodem
    config_get led_script "$1" led_script
    [ -n "$led_script" ] || return 0
    [ -x "/usr/share/qmodem/led_scripts/${led_script}.sh" ] || return 0
    procd_kill "$service" "led_$1"
    rc_procd _start_instance "$1"
}
''',
1,
)

if "H5000M_QMODEM_LED_EMPTY_GUARD" not in text:
    raise SystemExit(f"missing qmodem_led start_instance anchor in {path}")

path.write_text(text, encoding="utf-8")
PY
  echo "Applied QModem LED empty-instance guard: ${QMODEM_LED}"
else
  echo "Skipped QModem LED empty-instance guard: file missing or already patched."
fi
