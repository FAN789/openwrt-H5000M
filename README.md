# openwrt-H5000M

这是一个用于构建 Hiveton/Airpi H5000M 固件的项目。主源码直接使用 OpenWrt 官方仓库 `openwrt/openwrt` 的 `main` 分支及其原生 H5000M 设备支持，构建时仅叠加本项目的默认配置和可选插件。

## 上游 H5000M PR 注意事项

H5000M 官方支持已经合并到 OpenWrt `main`：
https://github.com/openwrt/openwrt/pull/21398

当前需要特别注意：

- 项目不再覆盖官方 DTS、镜像、网络、LED、升级或 WiFi MAC 配置。
- 官方使用 `eth1` 作为 LAN、`eth0` 作为有线 WAN。
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
4. 按 workflow 选项集成 QModem、PassWall2、MosDNS、UPnP、HomeProxy、vnStat2、MT5700M 管理页面。
5. 通过 GitHub Actions 或本地 Linux runner 编译固件。

## 插件来源

- QModem：`FUjr/QModem`
- PassWall2：`kenzok8/small-package`
- MosDNS / luci-app-mosdns：`kenzok8/small-package`
- HomeProxy：`kenzok8/small-package`
- UPnP：OpenWrt 官方 feeds
- ttyd / luci-app-ttyd：OpenWrt 官方 feeds
- vnStat2 / luci-app-vnstat2：OpenWrt 官方 feeds
- MT5700M 管理页面：独立 feed 包 [`FAN789/luci-app-mt5700m`](https://github.com/FAN789/luci-app-mt5700m)，构建时按选项拉取（不嵌入模块 WebUI）

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

- `openwrt_ref`: `main`；后续包含官方 H5000M 支持的分支或发行标签也可使用
- `runner_type`: `github-hosted` 或 `self-hosted`
- `qmodem_original`: 默认开启，使用 `luci-app-qmodem` 原版界面
- `qmodem_next`: 默认关闭，不要和 `qmodem_original` 同时开启
- `upnp`: 默认开启
- `passwall2`: 默认开启
- `homeproxy`: 默认关闭
- `mosdns`: 默认关闭
- `vnstat`: 默认开启
- `mt5700m`: 默认开启
- `eeprom_autoflash`: 默认关闭
- `create_release`: 默认开启
- `make_jobs`: 留空，或填写 `4`、`8` 这类线程数

固件产物来自：

```text
openwrt/bin/targets/mediatek/filogic
```

## 本地构建

请在 Linux、WSL2 或 Linux 编译机上运行：

```sh
INCLUDE_QMODEM_ORIGINAL=true \
INCLUDE_QMODEM_NEXT=false \
INCLUDE_PASSWALL2=true \
INCLUDE_MOSDNS=true \
INCLUDE_UPNP=true \
INCLUDE_HOMEPROXY=false \
bash ./scripts/prepare-source.sh main

cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a

INCLUDE_QMODEM_ORIGINAL=true \
INCLUDE_QMODEM_NEXT=false \
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

## 默认设置

- LAN IP：`192.168.10.1`
- root 密码：`admin`
- 默认时区：`Asia/Shanghai`
- LuCI 默认语言：`auto`
- 2.4G WiFi 名称：`H5000M-2G`
- 5G WiFi 名称：`H5000M-5G`
- WiFi 密码：`77778888`
- WiFi 区域：`CN`
- WiFi 加密：`WPA2-PSK/WPA3-SAE Mixed Mode`，UCI 中为 `sae-mixed`
- 2.4G WiFi：默认启用，SSID `H5000M-2G`，默认带宽 `EHT40`，不强制指定信道
- 5G WiFi：默认启用，SSID `H5000M-5G`，默认带宽 `EHT160`，不强制指定信道
- 有线 WAN 优先：`wan` / `wan6` metric 为 `10`
- 5G SIM 备用：QModem 生成的 `USB` / `USBv6` metric 为 `50`
- 首次启动时清理固件内的 QModem、small_package 和 video 软件源条目

内置 `luci-app-h5000m-netmode`，可在 LuCI 的“网络 / 出口优先级”中切换有线 WAN 和 5G 模块的优先级。

内置 `luci-app-h5000m-fancontrol`，可在 LuCI 的“系统 / 风扇控制”中设置自动、手动和关闭模式，并显示 PWM、模块温度、CPU 温度和 WiFi 温度。

内置 `luci-app-ttyd`，可在 LuCI 中打开 Web 终端。

内置 `luci-app-mt5700m`，在 LuCI 的“移动网络 / 5G 模组”中统一提供概览、连接与拨号、网络与小区信息、频段锁定、短信、系统/FOTA、高级设置和 AT 控制台。QModem 继续负责模组发现、串口仲裁与拨号，MT5700M 页面负责设备专属能力和统一交互；网络 AT 仅作为回退，不嵌入或依赖模块 WebUI。安装统一管理器后不再显示重复的旧 QModem 菜单，但 QModem 后端服务保持运行。

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
