include $(TOPDIR)/rules.mk

PKG_NAME:=h5000m-fancontrol
PKG_VERSION:=2.0.0
PKG_RELEASE:=3

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/h5000m-fancontrol
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=H5000M fan control service
  DEPENDS:=+kmod-hwmon-pwmfan
  PKGARCH:=all
endef

define Package/h5000m-fancontrol/description
  Safety-critical H5000M userspace fan controller without the LuCI interface.
endef

define Build/Compile
endef

define Package/h5000m-fancontrol/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/h5000m_fancontrol $(1)/etc/config/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/h5000m-fancontrol $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/91-h5000m-fancontrol-v2 $(1)/etc/uci-defaults/
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/h5000m-fancontrol $(1)/usr/sbin/
endef

define Package/h5000m-fancontrol/conffiles
/etc/config/h5000m_fancontrol
endef

$(eval $(call BuildPackage,h5000m-fancontrol))
