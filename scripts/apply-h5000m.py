#!/usr/bin/env python3
from pathlib import Path
import sys


DTS = r'''// SPDX-License-Identifier: (GPL-2.0 OR MIT)

/dts-v1/;
#include "mt7987a.dtsi"
#include <dt-bindings/input/input.h>
#include <dt-bindings/leds/common.h>

/ {
	model = "Hiveton H5000M";
	compatible = "hiveton,h5000m", "mediatek,mt7987a", "mediatek,mt7987";

	aliases {
		led-boot = &led_status;
		led-failsafe = &led_status;
		led-upgrade = &led_status;
		serial0 = &uart0;
	};

	chosen {
		bootargs = "earlycon=uart8250,mmio32,0x11000000 \
			    root=PARTLABEL=rootfs rootwait pci=pcie_bus_perf";
		stdout-path = "serial0:115200n8";
	};

	gpio-keys {
		compatible = "gpio-keys";

		button-reset {
			label = "reset";
			linux,code = <KEY_RESTART>;
			gpios = <&pio 1 GPIO_ACTIVE_LOW>;
			debounce-interval = <10>;
		};

		button-wps {
			label = "wps";
			linux,code = <KEY_WPS_BUTTON>;
			gpios = <&pio 0 GPIO_ACTIVE_LOW>;
			debounce-interval = <10>;
		};
	};

	leds {
		compatible = "gpio-leds";

		led_status: led-3 {
			function = LED_FUNCTION_WLAN_2GHZ;
			color = <LED_COLOR_ID_AMBER>;
			gpios = <&pio 3 GPIO_ACTIVE_LOW>;
			linux,default-trigger = "phy0tpt";
		};

		led-4 {
			function = LED_FUNCTION_WLAN_5GHZ;
			color = <LED_COLOR_ID_BLUE>;
			gpios = <&pio 4 GPIO_ACTIVE_LOW>;
			linux,default-trigger = "phy1tpt";
		};
	};

	reg_3p3v: regulator-3p3v {
		compatible = "regulator-fixed";
		regulator-name = "fixed-3.3V";
		regulator-min-microvolt = <3300000>;
		regulator-max-microvolt = <3300000>;
		regulator-boot-on;
		regulator-always-on;
	};

	reg_usb_5v: regulator-usb-5v {
		compatible = "regulator-fixed";
		regulator-name = "usb-5v";
		regulator-min-microvolt = <5000000>;
		regulator-max-microvolt = <5000000>;
		regulator-boot-on;
		regulator-always-on;
	};
};

&eth {
	status = "okay";
};

&fan {
	cooling-levels = <0 10 20 30 40 50 60 70 80 90 100 110 120
			  130 140 150 160 170 180 190 200 210 220 240 255>;
	#cooling-cells = <2>;
	#thermal-sensor-cells = <1>;
	pwms = <&pwm 1 50000 0>;
	status = "okay";
};

&gmac0 {
	phy-mode = "2500base-x";
	phy-handle = <&phy0>;
	status = "okay";
};

&gmac1 {
	phy-mode = "internal";
	phy-handle = <&phy1>;
	status = "okay";
};

&mdio {
	phy0: phy@1 {
		compatible = "ethernet-phy-ieee802.3-c45";
		reg = <1>;
		reset-gpios = <&pio 42 GPIO_ACTIVE_LOW>;
		reset-assert-us = <100000>;
		reset-deassert-us = <100000>;
		interrupt-parent = <&pio>;
		interrupts = <41 IRQ_TYPE_LEVEL_LOW>;
		realtek,aldps-enable;
	};

	phy1: phy@15 {
		compatible = "ethernet-phy-ieee802.3-c45";
		reg = <15>;
		pinctrl-names = "i2p5gbe-led";
		pinctrl-0 = <&i2p5gbe_led0_pins>;
	};
};

&mmc0 {
	pinctrl-names = "default", "state_uhs";
	pinctrl-0 = <&mmc_pins_default>;
	pinctrl-1 = <&mmc_pins_uhs>;
	bus-width = <8>;
	max-frequency = <48000000>;
	cap-mmc-highspeed;
	vmmc-supply = <&reg_3p3v>;
	non-removable;
	status = "okay";

	card@0 {
		compatible = "mmc-card";
		reg = <0>;

		block {
			compatible = "block-device";

			partitions {
				block-partition-factory {
					partname = "factory";

					nvmem-layout {
						compatible = "fixed-layout";
						#address-cells = <1>;
						#size-cells = <1>;

						eeprom_factory_0: eeprom@0 {
							reg = <0x0 0x1e00>;
						};
					};
				};
			};
		};
	};
};

&pcie0 {
	pinctrl-names = "default";
	pinctrl-0 = <&pcie0_pins>;
	reset-gpios = <&pio 36 GPIO_ACTIVE_HIGH>;
	status = "okay";

	pcie@0,0 {
		reg = <0x0000 0 0 0 0>;
		#address-cells = <3>;
		#size-cells = <2>;
		device_type = "pci";

		mt7992@0,0 {
			compatible = "mediatek,mt76";
			reg = <0x0000 0 0 0 0>;
			nvmem-cells = <&eeprom_factory_0>;
			nvmem-cell-names = "eeprom";
			#address-cells = <1>;
			#size-cells = <0>;
			ieee80211-freq-limit = <2400000 2500000>,
					       <5170000 5835000>;
		};
	};
};

&pcie1 {
	status = "disabled";
};

&pio {
	pwm_fan_pins: pwm-fan-pins {
		mux {
			function = "pwm";
			groups = "pwm1_0";
		};
	};
};

&pwm {
	status = "okay";
	pinctrl-names = "default";
	pinctrl-0 = <&pwm_fan_pins>;
};

&ssusb {
	status = "okay";
	vusb33-supply = <&reg_3p3v>;
	vbus-supply = <&reg_usb_5v>;
};

&tphyu3port0 {
	status = "okay";
};

&uart0 {
	pinctrl-names = "default";
	pinctrl-0 = <&uart0_pins>;
	status = "okay";
};
'''


DEVICE_BLOCK = r'''
define Device/hiveton_h5000m
  DEVICE_VENDOR := Hiveton
  DEVICE_MODEL := H5000M
  DEVICE_ALT0_VENDOR := Airpi
  DEVICE_ALT0_MODEL := H5000M
  DEVICE_DTS := mt7987a-hiveton-h5000m
  DEVICE_DTS_DIR := ../dts
  DEVICE_PACKAGES := kmod-hwmon-pwmfan kmod-usb3 mt7987-2p5g-phy-firmware \
	kmod-mt7996e kmod-mt7992-23-firmware f2fsck mkf2fs
  KERNEL_LOADADDR := 0x40000000
  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata
endef
TARGET_DEVICES += hiveton_h5000m

'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def require(path: Path) -> None:
    if not path.exists():
        raise SystemExit(f"Missing required file: {path}")


def insert_once(text: str, marker: str, insert: str, label: str) -> str:
    if insert.strip() in text:
        return text
    if marker not in text:
        raise SystemExit(f"Cannot find insertion point for {label}: {marker!r}")
    return text.replace(marker, insert + marker, 1)


def insert_after_all(text: str, anchor: str, insert: str) -> str:
    if anchor not in text:
        return text
    parts = text.split(anchor)
    rebuilt = [parts[0]]
    for part in parts[1:]:
        rebuilt.append(anchor)
        if not part.startswith(insert):
            rebuilt.append(insert)
        rebuilt.append(part)
    return "".join(rebuilt)


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

    mt7987a = root / "target/linux/mediatek/dts/mt7987a.dtsi"
    if not mt7987a.exists():
        raise SystemExit(
            "The selected OpenWrt source lacks target/linux/mediatek/dts/mt7987a.dtsi.\n"
            "H5000M needs MT7987 platform support. Use v25.12.4/master or backport MT7987 first."
        )

    dts_path = root / "target/linux/mediatek/dts/mt7987a-hiveton-h5000m.dts"
    dts_path.parent.mkdir(parents=True, exist_ok=True)
    write(dts_path, DTS + "\n")

    network = root / "target/linux/mediatek/filogic/base-files/etc/board.d/02_network"
    wifi_mac = root / "target/linux/mediatek/filogic/base-files/etc/hotplug.d/ieee80211/11_fix_wifi_mac"
    platform = root / "target/linux/mediatek/filogic/base-files/lib/upgrade/platform.sh"
    filogic = root / "target/linux/mediatek/image/filogic.mk"

    for path in (network, wifi_mac, platform, filogic):
        require(path)

    text = read(network)
    mt7987_case = "\tmediatek,mt7987*)\n\t\tucidef_set_interfaces_lan_wan \"eth0 hnat\" eth1\n\t\t;;"
    h5000m_case = "\thiveton,h5000m)\n\t\tucidef_set_interfaces_lan_wan eth0 eth1\n\t\t;;\n"
    for old_case in (
        "\thiveton,h5000m)\n\t\tucidef_set_interfaces_lan_wan eth1 eth0\n\t\t;;\n",
        "\thiveton,h5000m)\n\t\tucidef_set_interfaces_lan_wan \"eth0 hnat\" eth1\n\t\t;;\n",
    ):
        text = text.replace(old_case, h5000m_case)
    if h5000m_case.strip() not in text:
        if mt7987_case in text:
            text = text.replace(mt7987_case, h5000m_case + mt7987_case, 1)
        else:
            text = insert_once(text, "\topenembed,som7981|\\\n", h5000m_case, "network interface")

    mac_case = '''\thiveton,h5000m)
\t\tlan_mac=$(tr '\\0' '\\n' < /dev/mmcblk0p1 | sed -n 's/^ethaddr=//p' | head -n 1)
\t\t[ -n "$lan_mac" ] || lan_mac=$(macaddr_generate_from_mmc_cid mmcblk0)
\t\twan_mac=$(macaddr_add "$lan_mac" 1)
\t\tlabel_mac=$wan_mac
\t\t;;
'''
    if mac_case.strip() not in text:
        if "\tjiorouter,ax6000-jidu6101)" in text:
            text = text.replace("\tjiorouter,ax6000-jidu6101)", mac_case + "\tjiorouter,ax6000-jidu6101)", 1)
        else:
            text = text.replace("\tmercusys,mr80x-v3|\\\n", mac_case + "\tmercusys,mr80x-v3|\\\n", 1)
    write(network, text)

    text = read(wifi_mac)
    wifi_case = '''\thiveton,h5000m)
\t\tbase_mac=$(tr '\\0' '\\n' < /dev/mmcblk0p1 | sed -n 's/^ethaddr=//p' | head -n 1)
\t\t[ -n "$base_mac" ] || base_mac=$(macaddr_generate_from_mmc_cid mmcblk0)
\t\t[ "$PHYNBR" = "0" ] && macaddr_add $base_mac 2 > /sys${DEVPATH}/macaddress
\t\t[ "$PHYNBR" = "1" ] && macaddr_add $base_mac 3 > /sys${DEVPATH}/macaddress
\t\t;;
'''
    if "\thiveton,h5000m)" not in text:
        text = insert_once(text, "\tiptime,ax3000q)", wifi_case, "wifi MAC")
    write(wifi_mac, text)

    text = read(platform)
    text = insert_after_all(text, "\tglinet,gl-xe3000|\\\n", "\thiveton,h5000m|\\\n")
    text = insert_after_all(text, "\tcreatlentem,clt-r30b1-112m|\\\n", "\thiveton,h5000m|\\\n")
    write(platform, text)

    text = read(filogic)
    if "Device/hiveton_h5000m" not in text:
        for marker in ("define Device/huasifei_wh3000", "define Device/huasifei_wh3000-emmc"):
            if marker in text:
                text = text.replace(marker, DEVICE_BLOCK + marker, 1)
                break
        else:
            raise SystemExit("Cannot find a place to add Device/hiveton_h5000m in filogic.mk")
    write(filogic, text)

    print("H5000M device support applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
