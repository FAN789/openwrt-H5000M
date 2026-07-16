include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mt5700m
PKG_VERSION:=2.0.0
PKG_RELEASE:=11
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=MT5700M module management
LUCI_DEPENDS:=+luci-base +busybox +ubus-at-daemon +sms-tool_q +kmod-usb2 +kmod-usb3 +kmod-usb-serial +kmod-usb-serial-option +kmod-usb-net +kmod-usb-net-cdc-ether +kmod-usb-net-cdc-ncm
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
