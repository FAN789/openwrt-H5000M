# openwrt-H5000M

这是一个用于构建 Hiveton/Airpi H5000M 固件的项目。主源码直接使用 OpenWrt 官方仓库 `openwrt/openwrt` 及其原生 H5000M 设备支持，构建时仅叠加本项目的默认配置和可选插件。默认源码锁定在已通过 H5000M 实机启动验证的官方提交，更新上游版本时应重新完成 initramfs 验证。

## 上游 H5000M PR 注意事项

H5000M 官方支持已经合并到 OpenWrt `main`：
https://github.com/openwrt/openwrt/pull/21398

当前需要特别注意：

- 项目不再覆盖官方 DTS、镜像、网络、LED、升级或 WiFi MAC 配置。
- 官方使用 `eth0` 作为 LAN、`eth1` 作为有线 WAN。
- 官方从 eMMC CID 派生 LAN、WAN 和 WiFi MAC，本项目不再用 U-Boot `ethaddr` 覆盖该策略。
- 官方从 `mmcblk0p2` 的 `eeprom@0` 读取 `0x1e00` 字节作为 WiFi EEPROM。

## WiFi EEPROM

如果系统日志出现 `mt7996e ... eeprom load fail, use default bin`，并且确认 `/dev/mmcblk0p2` 全 0，可参考官方 PR 的说明手动写入厂商 EEPROM 文件。

可选工作流参数 `eeprom_autoflash` 默认关闭。开启后，固件首次启动时会验证并自动写入 `/dev/mmcblk0p2`：

- 文件路径：`/lib/firmware/h5000m/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin`
- 文件大小必须是 `7680`
- SHA256 必须是 `d524a4fd42dc942cae178d465073238f035e89998494c1012218c03662f5dcbd`
- `/dev/mmcblk0p2` 当前 7680 字节必须全 0

如果 `/dev/mmcblk0p2` 已经有非零数据，脚本会跳过，不会覆盖。写入前会把原始 7680 字节备份到 `/root/h5000m-eeprom-backup/mmcblk0p2-before-autoflash.bin`。

## 项目功能

1. 拉取指定版本的 OpenWrt 官方源码。
2. 验证所选 OpenWrt 源码已经包含官方 H5000M 设备支持。
3. 使用 `configs/h5000m.seed` 选择 MediaTek Filogic / H5000M 目标。
4. 按 workflow 选项集成 MT5700M 专用管理器、PassWall2、MosDNS、UPnP、HomeProxy 和 vnStat2。
5. 通过 GitHub Actions 或本地 Linux runner 编译固件。

## 插件来源

- AT/SMS 传输组件：从 `FUjr/QModem` 的锁定提交构建 `ubus-at-daemon` 与 `sms-tool_q`；不构建或安装 QModem 主程序
- PassWall2：`kenzok8/small-package`
- MosDNS / luci-app-mosdns：`kenzok8/small-package`
- HomeProxy：`kenzok8/small-package`
- UPnP：OpenWrt 官方 feeds
- ttyd / luci-app-ttyd：OpenWrt 官方 feeds
- vnStat2 / luci-app-vnstat2：OpenWrt 官方 feeds
- MT5700M 模组管理：本仓库 `packages/luci-app-mt5700m`，内置专用发现、NCM 驱动仲裁、双栈接口、拨号监督和 RPC 服务（不嵌入模块 WebUI）

勾选 PassWall2、MosDNS、HomeProxy 任意一个时，会自动添加 `kenzok8/small-package`。

## PassWall2 默认配置

构建时勾选 `passwall2` 后会集成：

- `luci-app-passwall2`
- `xray-core`
- `sing-box`
- `tcping`
- `v2ray-geoip`
- `v2ray-geosite`
- `v2ray-plugin`
- `geoview`，目标路径 `/usr/bin/geoview`

固件首次启动会写入一套占位分流配置：

- PassWall2 默认启用。
- 主节点为 Xray 分流节点：`总分流`。
- 示例 VLESS 节点：`lax`、`tky`。
- 自动选择代理：`自动选择代理`，在 `lax` 与 `tky` 之间使用 `leastPing`，fallback 为 `lax`，探测 URL 为 `https://www.gstatic.com/generate_204`。
- SOCKS 代理保持 PassWall2 默认关闭状态，需要时可在 LuCI 中手动启用。
- IPv6 透明代理默认关闭。
- 节点信息全部是示例占位，不包含真实 server、UUID、SNI、私钥或订阅。

默认规则顺序：

1. `PrivateIP` -> 直连
2. `苹果服务` -> 直连
3. `微软服务` -> 直连
4. `China` -> 直连
5. `测速服务` -> 直连
6. `游戏平台` -> 直连
7. `PayPal` -> 直连
8. `AI与开发服务` -> 自动选择代理
9. `海外流媒体` -> lax
10. `海外社交通讯` -> 自动选择代理
11. `谷歌服务` -> 自动选择代理
12. `非中国大陆` -> 自动选择代理

本项目不会加入 `geoip:cloudflare`、`geoip:cloudfront`、`geoip:fastly` 这类通用 CDN IP 分流规则，避免误伤无关网站。

## GitHub Actions 构建

打开 `构建 openwrt-H5000M 固件` workflow，手动运行。

建议输入：

- `openwrt_ref`: 默认使用 `configs/openwrt.ref` 中已验证的官方提交；也可显式填写后续包含官方 H5000M 支持的提交、分支或发行标签
- `runner_type`: `github-hosted` 或 `self-hosted`
- `upnp`: 默认开启
- `passwall2`: 默认开启
- `homeproxy`: 默认关闭
- `mosdns`: 默认关闭
- `vnstat`: 默认开启
- `mt5700m`: 默认开启
- `eeprom_autoflash`: 默认关闭
- `clean_build`: 默认开启，避免本地 Runner 的增量缓存混入旧内核或软件包
- `create_release`: 默认关闭；完成 initramfs 实机启动和功能回归后再发布
- `make_jobs`: 留空，或填写 `4`、`8` 这类线程数

固件产物来自：

```text
openwrt/bin/targets/mediatek/filogic
```

## 本地构建

请在 Linux、WSL2 或 Linux 编译机上运行：

```sh
INCLUDE_MT5700M=true \
INCLUDE_PASSWALL2=true \
INCLUDE_MOSDNS=true \
INCLUDE_UPNP=true \
INCLUDE_HOMEPROXY=false \
bash ./scripts/prepare-source.sh

cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a

INCLUDE_PASSWALL2=true \
INCLUDE_MOSDNS=true \
INCLUDE_UPNP=true \
INCLUDE_HOMEPROXY=false \
INCLUDE_VNSTAT=true \
INCLUDE_MT5700M=true \
bash ../scripts/apply-package-options.sh

make defconfig
make download -j8
make -j"$(nproc)"
```

独立插件包必须使用持久化签名密钥。默认从
`$HOME/.config/h5000m-apk/private-key.pem` 和 `public-key.pem` 读取；私钥只保存在受控编译机，不进入 Git。固件只内置对应公钥，因此正式插件安装不得使用 `--allow-untrusted`。临时开发构建如确需使用 SDK 随机密钥，必须显式设置 `H5000M_ALLOW_EPHEMERAL_SIGNING_KEY=1`，其产物不得发布。

推荐交付方式是“官方基线 + 签名离线插件仓库”：

1. `scripts/build-official-base-local.sh` 使用官方 H5000M ImageBuilder 生成仅包含中文 LuCI、常用工具和安全首启默认值的 sysupgrade 固件。
2. `scripts/configure-official-sdk.sh SDK_DIR` 配置与基线完全匹配的官方 SDK，并使用持久化 H5000M APK 密钥构建插件。
3. `scripts/build-offline-plugin-repo.sh SDK_DIR BASE_ARTIFACT_DIR OUTPUT_DIR` 收集风扇、出口策略、MT5700M 专用管理器及其最小依赖，验签、创建仓库索引，并在解包后的全新官方基线中执行断网安装模拟。
4. 全新设备安装插件时，直接使用交付目录中的 `packages.adb`；不得添加临时不可信参数。

## 默认设置

- LAN IP：`192.168.10.1`
- root 密码：不预置；首次通过有线 LAN 登录 LuCI 后必须立即设置
- 默认时区：`Asia/Shanghai`
- LuCI 默认语言：简体中文（`zh_cn`）
- WiFi：沿用官方 OpenWrt 首启策略，默认不启用、不预置统一 SSID 或共享密码
- 首次配置：通过有线 LAN 登录 LuCI，选择所在国家/地区并为各频段设置独立的强密码后再启用无线
- WAN 红灯：绑定官方 `eth1` WAN，链路接通时点亮，收发数据时闪烁
- 有线 WAN 优先：`wan` / `wan6` metric 为 `10`
- 5G SIM 备用：专用管理器生成的 `MT5700M` / `MT5700Mv6` metric 为 `50`
- 首次启动时清理构建期第三方、small_package 和 video 软件源条目

离线插件仓库提供 `luci-app-h5000m-netmode`，可在 LuCI 的“移动网络 / 出口优先级”中切换有线 WAN 和 5G 模块的优先级。

离线插件仓库提供 `luci-app-h5000m-fancontrol`，可在 LuCI 的“系统 / 风扇控制”中设置自动、手动和仅内核保护模式，并显示 PWM、模块温度、CPU 温度和 WiFi 温度。

内置 `luci-app-ttyd`，但默认不启动；管理员完成设密后可按需启用 Web 终端。

管理面默认将 HTTP 跳转到 HTTPS。SSH 密码登录默认关闭，避免设备在尚未完成首次设密时暴露空密码管理入口；需要 SSH 时应先配置管理员密码和公钥，再显式启用相应认证方式。

离线插件仓库提供 `luci-app-mt5700m`，在 LuCI 的“移动网络 / MT5700M 模组”中按用户任务提供概览、移动数据、网络与小区、短信、设备与 SIM、硬件、AT 控制台和管理器设置。拨号、IPv4/IPv6 会话、DNS、模组流量计数、详细数据会话、IP 直通与 PDP 上下文集中在“移动数据”；接入顺序、漫游、服务域、WCDMA/LTE 频段、5G 架构、MCS、QCI、NR 发射功率、SSB、锁频锁小区集中在“网络与小区”；ICCID/IMSI、网络时间、SIM PIN、SIM 激活/卡槽、温保门限与日志、FOTA、恢复出厂和受保护的设备身份实验室集中在“设备与 SIM”；只有 USB、PCIe、SIM 热插拔和底层接口形态保留在“硬件”。页面与参数语义按鼎桥原厂 AT、USB 和 Linux 驱动文档规范，正常运行时严格识别 `3466:3301`，并通过 PCUI 描述符定位 AT 端口；`3302` 升级模式和 `3303` Dump 模式仅用于状态诊断，不会启动拨号。插件自己的 `mt5700m-manager` 负责 NCM/Option 驱动仲裁、热插拔、IPv4/IPv6 接口、路由策略、连接/断开/重拨和启动恢复；不安装 QModem 主程序、通用扫描器、其他厂商脚本或 QMI/MBIM/PCIe 拨号组件。`ubus-at-daemon` 与 `sms_tool_q` 作为无界面的最小传输依赖自动安装。

## 本地 Runner

当前 workflow 的 self-hosted runner 标签为：

```text
self-hosted, Linux, X64, homelab, lxc, openwrt-h5000m
```

本地 runner 下载缓存路径：

```text
/home/builder/openwrt-h5000m-cache/dl
```

为保证稳定复现，当前默认关闭 ccache。
