# openwrt-H5000M

Hiveton/Airpi H5000M 的干净基础固件构建项目。主包直接使用 OpenWrt 官方 ImageBuilder 和官方 H5000M 设备支持，只补充 Web 管理、中文、常用工具和产品级首启默认值，不维护 DTS、端口布局、内核补丁或自研应用副本。

## 主包边界

主包只包含：

- OpenWrt 官方 H5000M 系统与驱动
- LuCI HTTPS 管理界面和简体中文
- 软件包管理器、ttyd（预装但默认停用）
- 常用诊断、存储和 USB 工具
- OpenWrt 官方 UPnP LuCI 与 `miniupnpd-nftables`
- H5000M 插件仓库公钥（仅公钥，不包含签名私钥）

主包明确不包含：

- H5000M 风扇管理
- MT5700M 模组管理和 5G 流量统计
- 有线 WAN / 5G 出口优先级
- PassWall2 主程序、运行依赖、代理核心、节点、分流或凭据配置
- QModem 主程序、第三方 feed、原厂 MT5700M WebUI
- EEPROM 自动写入、非官方 DTS 或内核补丁

这些功能以独立签名插件交付，插件故障不会影响基础系统启动。

## 独立插件

| 功能 | 独立仓库 |
| --- | --- |
| H5000M 风扇管理 | [luci-app-h5000m-fancontrol](https://github.com/FAN789/luci-app-h5000m-fancontrol) |
| MT5700M 模组管理及 5G 流量统计 | [luci-app-mt5700m](https://github.com/FAN789/luci-app-mt5700m) |
| 有线 WAN / 5G 出口优先级 | [luci-app-h5000m-netmode](https://github.com/FAN789/luci-app-h5000m-netmode) |
| PassWall2 离线安装包 | [luci-app-passwall2-h5000m](https://github.com/FAN789/luci-app-passwall2-h5000m) |

UPnP 来自 OpenWrt 官方软件源，直接预装在主包中，不建立独立项目。

## 官方基线

构建参数集中在 `configs/official-base.env`：

- OpenWrt：`r35346-e9aa5bea9f`
- 目标：`mediatek/filogic`
- 设备：`hiveton_h5000m`
- 架构：`aarch64_cortex-a53`
- Kernel：`6.18.38`
- Kernel ABI：`93edd57b5daa2a685ba2b251f368f171`
- 构建器：官方 OpenWrt Snapshot ImageBuilder（固定 SHA256）

官方端口定义保持不变：`eth0` 是 LAN，`eth1` 是有线 WAN。MAC、WiFi EEPROM、LED 和 sysupgrade 布局全部沿用 OpenWrt 官方实现。

## 产品默认值

- LAN：`192.168.10.1/24`
- 主机名：`H5000M`
- 时区：`Asia/Shanghai`
- LuCI：简体中文、HTTP 自动跳转 HTTPS
- 管理员：root 默认密码为 `root`
- WiFi：2.4GHz/5GHz 双频同名 `H5000M`，默认密码 `77778888`
- WiFi 频宽：2.4GHz 使用 `EHT40`，5GHz 使用 `EHT160`
- WiFi 安全与漫游：默认开启、WPA2/WPA3 混合模式、802.11w 可选保护及 802.11k 辅助漫游
- ttyd：预装但默认停用
- SSH：默认开启 root 密码登录，同时保留公钥登录
- UPnP：软件包默认集成，运行策略仍由 OpenWrt 官方配置控制
- PassWall2：主程序及 `dnsmasq-full`、nftables/kmod 依赖全部由独立离线包负责

## 首次使用

1. 只使用名称中带 `squashfs-sysupgrade.bin` 的文件刷写或升级系统。
2. 通过 LAN 访问 `https://192.168.10.1`，使用 root / `root` 登录；WiFi 初始名称为 `H5000M`，密码为 `77778888`。
3. 按需安装独立插件；插件版本必须与主包的 OpenWrt 版本和内核 ABI 匹配。
4. 安装或升级后保留对应固件、插件包和 `SHA256SUMS`，便于恢复与核验。

默认管理密码和无线密码用于首次部署，均属于公开弱密码。设备接入不受信任网络前应立即修改。

插件压缩包、APK 和 `packages.adb` 都不是固件，不能通过 U-Boot 或 LuCI 固件升级页面刷写。

## 本地构建

在 x86_64 Linux 编译机执行：

```sh
./scripts/check-main-package.sh
./scripts/build-official-base-local.sh
```

可覆盖缓存和产物目录：

```sh
OPENWRT_LOCAL_CACHE=/home/builder/openwrt-official-cache \
OPENWRT_LOCAL_ARTIFACTS=/home/builder/artifacts \
./scripts/build-official-base-local.sh
```

构建脚本会校验 ImageBuilder 哈希、固件版本、Kernel ABI、LuCI、中文、UPnP、首启默认值和软件包清单，并确认主包使用官方精简 `dnsmasq`、没有混入 PassWall2 专用 kmod、代理核心或代理配置。

本地构建需要 `curl`、`flock`、GNU Make、`sha256sum`、GNU tar、`unsquashfs` 和 Zstandard 支持。

## GitHub Actions

手动运行“构建 H5000M 官方基础固件”。工作流先执行主包边界检查，再在本地 Linux runner 上调用同一构建脚本，避免维护两套构建逻辑。

产物目录包含：

- `openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin`
- `installed-package-manifest.txt`
- `official-base.packages`
- `profiles.json`
- `BUILD-INFO.txt`
- `SHA256SUMS`

每次构建都会把完整安装清单和基线信息放入产物目录；发布前应核对 `custom_plugins_included=false` 和 `upnp_included=true`。
PassWall2 相关核对项为 `passwall2_included=false`、`passwall2_runtime_prerequisites_included=false` 和 `dnsmasq_variant=compact`。

## 仓库结构

```text
.github/workflows/build.yml       唯一的主包工作流
configs/official-base.env         固定官方基线和 ImageBuilder 哈希
configs/official-base.packages    主包软件清单
official-base-files/              最小产品默认值和插件公钥
scripts/check-main-package.sh     仓库边界与隐私检查
scripts/build-official-base-local.sh  构建和固件内容验证
```

更新 OpenWrt 基线时，必须同步更新 `official-base.env` 的版本与 ImageBuilder SHA256，并重新完成启动、LAN/WAN、LuCI、UPnP、升级和插件安装回归。
