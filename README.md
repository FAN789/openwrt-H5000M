# openwrt-H5000M

Hiveton H5000M 的干净基础固件构建项目。主包直接使用 OpenWrt 官方 ImageBuilder 与官方 H5000M 设备支持，只补充 Web 管理、中文、常用工具和产品级首启默认值，不维护 DTS、端口布局、内核补丁或自研应用副本。

## 主包边界

主包只包含：

- OpenWrt 官方 H5000M 系统与驱动
- LuCI HTTPS 管理界面和简体中文
- 软件包管理器、ttyd（默认开启，http://192.168.10.1:7681/）
- 常用诊断、存储和 USB 工具
- OpenWrt 官方 UPnP LuCI 与 `miniupnpd-nftables`
- H5000M 插件仓库公钥（仅公钥，不包含签名私钥）

主包明确不包含：

- 任何自研 LuCI 插件（风扇、5G 模组管理、出口优先级等）
- 第三方 feed、非官方 DTS 或内核补丁

这些功能以独立签名插件交付，插件故障不会影响基础系统启动。

## 独立插件

| 功能 | 维护位置 |
| --- | --- |
| H5000M 风扇管理 | [luci-app-h5000m-fancontrol](https://github.com/FAN789/luci-app-h5000m-fancontrol) |
| MT5700M 模组管理及 5G 流量统计 | [luci-app-mt5700m](https://github.com/FAN789/luci-app-mt5700m) |
| 有线 WAN / 5G 出口优先级 | [luci-app-h5000m-netmode](https://github.com/FAN789/luci-app-h5000m-netmode) |

UPnP 来自 OpenWrt 官方软件源，直接预装在主包中，不建立独立项目。

## 构建基线

公开构建仅使用经审查的 **OpenWrt 正式发布版**，不使用 Snapshot、RC 或开发分支。
当前固定为 **25.12.6 / r33311-981c978eff / Linux 6.12.112**，目标为
`mediatek/filogic`、设备 `hiveton_h5000m`、架构 `aarch64_cortex-a53`。

`configs/official-base.env` 固定官方 release ImageBuilder 的文件名、SHA256、revision 和内核 ABI；
构建失败不会回退到 Snapshot。每周任务复用这一正式版基线，不自动升级尚未审查的新版本。
更新基线必须同时核对官方校验和、设备支持、内核 ABI 及构建验证结果。

公开固件仍为纯基础系统，不包含 daed/dae、Passwall、Hijpass、MT5700M、风扇、出口优先级或定制首页。
含插件和个人配置的集成固件仅在本地使用，集成构建配方已从当前公开主分支移除；历史提交和旧 Release 保留。
公开主包与本地集成固件的配置、内核能力和验收记录不能混用。

版本以 [最新 Release](https://github.com/FAN789/openwrt-H5000M/releases/latest) 的
`BUILD-INFO.txt` 为准，正式版应显示 `openwrt_version=25.12.6`、`release_channel=stable`、
`custom_plugins_included=false` 和 `proxy_plugins_included=false`。
旧的 `openwrt-r...` 发布是历史 Snapshot，不代表当前正式版方案。

官方端口定义保持不变：`eth0` 是 LAN，`eth1` 是有线 WAN。MAC、WiFi EEPROM、LED 和 sysupgrade 布局沿用官方实现。

## 产品默认值

- LAN：`192.168.10.1/24`
- 主机名：`H5000M`
- 时区：`Asia/Shanghai`
- LuCI：简体中文、HTTP 自动跳转 HTTPS
- 管理员：root 默认密码为 `root`
- WiFi：2.4GHz/5GHz 双频同名 `H5000M`，默认密码 `77778888`
- WiFi 频宽：2.4GHz 使用 `EHT40`，5GHz 使用 `EHT160`
- WiFi 安全与漫游：默认开启、WPA2/WPA3 混合模式、802.11w 可选保护及 802.11k 辅助漫游
- ttyd：默认开启（http://192.168.10.1:7681/）
- SSH：默认开启 root 密码登录，同时保留公钥登录
- UPnP：软件包默认集成，运行策略仍由 OpenWrt 官方配置控制
- IPv6：默认不分配 ULA，仅使用活动上游委派的公网前缀；ULA 可由高级用户按需启用

## 首次使用

1. 只使用名称中带 `squashfs-sysupgrade.bin` 的文件刷写或升级系统。
2. 通过 LAN 访问 `https://192.168.10.1`，使用 root / `root` 登录；WiFi 初始名称为 `H5000M`，密码为 `77778888`。
3. 按需安装独立插件；插件版本必须与主包的 OpenWrt 版本和内核 ABI 匹配。
4. 安装或升级后保留对应固件、插件包和 `SHA256SUMS`，便于恢复与核验。

默认管理密码和无线密码用于首次部署，均属于公开弱密码。设备接入不受信任网络前应立即修改。
这些产品默认值只在首次安装时写入；标记文件会随 sysupgrade 保留，后续升级不会
重置主机名、LAN、SSH、WiFi 或 root 密码。

插件压缩包、APK 和 `packages.adb` 都不是固件，不能通过 U-Boot 或 LuCI 固件升级页面刷写。

## 本地构建

在 x86_64 Linux 编译机执行（只编译基础固件，不读取本机设备配置）：

```sh
./scripts/check-main-package.sh
./scripts/check-product-safety.sh
bash ./scripts/test-base-policy.sh
./scripts/build-official-base-local.sh
```

可覆盖缓存和产物目录：

```sh
OPENWRT_LOCAL_CACHE=/home/builder/openwrt-official-cache \
OPENWRT_LOCAL_ARTIFACTS=/home/builder/artifacts \
./scripts/build-official-base-local.sh
```

构建脚本会校验 ImageBuilder 哈希、固件版本、Kernel ABI、LuCI、中文、UPnP、首启默认值和软件包清单。

本地构建需要 `curl`、`flock`、GNU Make、`sha256sum`、GNU tar、`unsquashfs`、Python 3、OpenSSL 和 Zstandard 支持。

## GitHub Actions（云编译）

- 定时触发：每周一 `04:00 UTC`（北京时间 `12:00`）自动构建并发布。
- 手动触发：运行"构建 H5000M 官方基础固件"工作流。
- 标签触发：推送 `openwrt-*` 或 `v*` 标签时自动构建并发布 GitHub Release。

工作流在 GitHub 托管的 `ubuntu-24.04` runner 上先执行主包边界检查，再调用同一构建脚本，避免维护两套构建逻辑。产物目录包含：

- `openwrt-25.12.6-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin`
- `installed-package-manifest.txt`
- `official-base.packages`
- `profiles.json`
- `BUILD-INFO.txt`
- `SHA256SUMS`

发布前核对正式版本号、SHA256、内核 ABI、`custom_plugins_included=false`、`proxy_plugins_included=false` 和 `upnp_included=true`。安装包清单会再次检查禁止的插件/代理依赖。发布仅上传固件和校验/构建信息，不上传工作区、日志、配置备份、节点或身份文件。

分支推送和 PR 只运行检查；定时、手动或版本标签触发完整云编译。定时/手动发布名包含正式版本和运行编号，不覆盖旧版本资产；标签发布指定实际源码提交。

## 仓库结构

```text
.github/workflows/build.yml       主包每周、手动和标签云编译工作流
configs/official-base.env         固定的正式版、内核 ABI 和 ImageBuilder SHA256
configs/official-base.packages    主包软件清单
configs/forbidden-base.packages   自研/代理插件禁止清单
official-base-files/              最小产品默认值和插件公钥
scripts/check-main-package.sh     仓库边界与隐私检查
scripts/check-product-safety.sh   产品安全与 ACL 检查
scripts/build-official-base-local.sh  构建和固件内容验证
```

更新回退基线或发布新固件时，必须重新完成启动、LAN/WAN、LuCI、UPnP、升级和插件安装回归，并保留该次构建的 `BUILD-INFO.txt` 与 `SHA256SUMS`。

本仓库的固件编译和内容检查不等同于实机启动验收。切换正式版后须在目标设备验证启动、LAN/WAN、WiFi、LuCI、UPnP 和升级/回退；不要将本地定制固件的验收结果当作此公开基础固件的证明。
