# openwrt-H5000M

这是一个用于构建 Hiveton/Airpi H5000M 固件的项目。主源码使用 OpenWrt 官方仓库 `openwrt/openwrt`，默认版本为 `v25.12.4`，构建时自动叠加 H5000M 设备适配和可选插件。

## 上游 H5000M PR 注意事项

本项目持续参考 OpenWrt 官方 H5000M 支持 PR：

https://github.com/openwrt/openwrt/pull/21398

当前需要特别注意：

- 官方 PR 使用 `KERNEL_LOADADDR := 0x40000000`，本项目保持一致。
- 结合官方固件和实机日志，H5000M 当前使用 `eth0` 作为 LAN，`eth1` 作为有线 WAN，本项目按 `ucidef_set_interfaces_lan_wan eth0 eth1` 生成默认网口布局。
- 官方 PR 当前只把两个 WiFi 指示灯交给 OpenWrt 管理，其他 LED 可能由硬件或厂商服务控制。本项目保持官方 LED 配置，不再额外添加 `pwm_led`。
- 官方 PR 的 `factory` 分区读取方式是从 `mmcblk0p2` 的 `eeprom@0` 读取 `0x1e00` 字节作为 WiFi EEPROM，没有在 `factory` 分区定义有线 MAC。
- 你当前实机反馈的 `/dev/mmcblk0p2` 内容为全 0，因此即使使用官方 PR 的 EEPROM 读取方式，WiFi 校准仍可能加载失败。官方 PR 目前提到可从厂商/PadavanOnly 固件中取 `MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin` 写入 `mmcblk0p2`，但本项目不会自动写入该分区，避免误写校准数据。
- MAC 地址默认以 `/dev/mmcblk0p1` 的 U-Boot 环境变量 `ethaddr` 为基准连续派生；如果 U-Boot 环境失效，则使用 eMMC CID 生成稳定本地 MAC 作为二级兜底。ETH0 使用 `base + 0`，ETH1 使用 `base + 1`，2.4G WiFi 使用 `base + 2`，5G WiFi 使用 `base + 3`。

## WiFi EEPROM 手动修复参考

如果系统日志出现 `mt7996e ... eeprom load fail, use default bin`，并且确认 `/dev/mmcblk0p2` 全 0，可参考官方 PR 的说明手动写入厂商 EEPROM 文件。

前提：

- 你已经确认手头文件来自适配 H5000M / MT7992 2+3 天线形态的厂商固件。
- 文件名通常为 `MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin`。
- 该操作会直接写入 eMMC factory 分区，请先确认设备和文件来源，不要盲目执行。

参考命令：

```sh
ls -lh /lib/firmware/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin
hexdump -C /dev/mmcblk0p2 | head -n 20

dd if=/lib/firmware/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin of=/dev/mmcblk0p2 bs=1 count=7680
sync
reboot
```

写入后可检查：

```sh
dmesg | grep -iE 'mt799|mt76|eeprom|cal|firmware'
iwinfo
```

也可以在 GitHub Actions 手动运行时勾选 `eeprom_autoflash` 构建自动刷写版固件。该选项默认关闭；开启后固件首次启动时会先校验：

- `/lib/firmware/h5000m/MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin` 必须存在
- 文件大小必须是 `7680`
- SHA256 必须是 `d524a4fd42dc942cae178d465073238f035e89998494c1012218c03662f5dcbd`
- `/dev/mmcblk0p2` 当前 7680 字节必须全 0

如果 `/dev/mmcblk0p2` 已经有非零数据，脚本会跳过，不会覆盖。写入前会把原始 7680 字节备份到 `/root/h5000m-eeprom-backup/mmcblk0p2-before-autoflash.bin`。

## 项目做什么

1. 拉取指定版本的 OpenWrt 官方源码。
2. 应用 H5000M 设备适配：DTS、镜像定义、网络、升级、WiFi MAC、LED、风扇和默认配置。
3. 使用 `configs/h5000m.seed` 选择 MediaTek Filogic / H5000M 目标。
4. 按 workflow 选项集成 QModem、PassWall、MosDNS、UPnP、HomeProxy、vnStat2。
5. 通过 GitHub Actions 或本地 Linux runner 编译固件。

## 插件来源

- QModem：`FUjr/QModem`
- PassWall：`kenzok8/small-package`
- MosDNS / luci-app-mosdns：`kenzok8/small-package`
- HomeProxy：`kenzok8/small-package`
- UPnP：OpenWrt 官方 feeds
- ttyd / luci-app-ttyd：OpenWrt 官方 feeds
- usteer / luci-app-usteer：OpenWrt 官方 feeds，用于同名 SSID 下的 5G 优先引导
- vnStat2 / luci-app-vnstat2：OpenWrt 官方 feeds
- MT5700M 管理页面：本项目自带 `luci-app-mt5700m`，参考 `inotdream/mt5700webui-openwrt-server`、`vadimrew/mt5700webui-openwrt-server` 和 `Coming-2022/mt5700m_at_control`。当前同时提供 LuCI 原生页面和内嵌原生 WebUI，默认通过本机 WebSocket/AT 代理访问 MT5700M，避免直接占用 QModem 正在使用的串口。

勾选 PassWall、MosDNS、HomeProxy 任意一个时，会自动添加 `kenzok8/small-package`。

## GitHub Actions 构建

打开 `构建 openwrt-H5000M 固件` workflow，手动运行。

建议输入：

- `openwrt_ref`: `v25.12.4`
- `runner_type`: `github-hosted` 或 `self-hosted`
- `qmodem_original`: 默认开启，使用 `luci-app-qmodem` 原版界面
- `qmodem_next`: 默认关闭，使用 `luci-app-qmodem-next`、`luci-app-qmodem-monitor`、`luci-app-qmodem-ttlfw4`；不要和 `qmodem_original` 同时开启
- `upnp`: 默认开启
- `passwall`: 默认开启
- `homeproxy`: 默认关闭
- `mosdns`: 默认开启，勾选 `luci-app-mosdns`，相关依赖由软件包自动带入
- `vnstat`: 默认开启，勾选 `luci-app-vnstat2`、`vnstat2`、`vnstati2`，用于累计流量统计
- `mt5700m`: 默认开启，添加 `移动网络 / MT5700M 管理` 页面，当前包含内嵌 WebUI，并通过本机 WebSocket/AT 代理访问模块
- `eeprom_autoflash`: 默认关闭；开启后会在构建时下载 `MT7991_MT7976_EEPROM_BE5040_iPAiLNA.bin` 并打入固件。首次启动时仅在 `/dev/mmcblk0p2` 当前 7680 字节全 0、且 EEPROM 文件大小和 SHA256 均正确时自动写入，写入成功后自动重启一次
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
INCLUDE_PASSWALL=true \
INCLUDE_MOSDNS=true \
INCLUDE_UPNP=true \
INCLUDE_HOMEPROXY=false \
bash ./scripts/prepare-source.sh v25.12.4

cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a

INCLUDE_QMODEM_ORIGINAL=true \
INCLUDE_QMODEM_NEXT=false \
INCLUDE_PASSWALL=true \
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
- LuCI 默认语言：`auto`，跟随浏览器和系统默认语言
- WiFi 名称：`H5000M`
- WiFi 密码：`1234567890`
- WiFi 区域：`CN`
- WiFi 加密：`WPA2-PSK/WPA3-SAE Mixed Mode`（UCI 为 `sae-mixed`）
- 2.4G WiFi：默认启用，默认带宽 `EHT40`，不由本项目强制指定信道
- 5G WiFi：默认启用，默认带宽 `EHT160`，不由本项目强制指定信道
- WiFi 漫游与引导：默认集成 `usteer`，并为同名 SSID 开启 802.11k、邻居报告和 band steering；允许少量客户端场景下也进行 5G 优先引导。当前 OpenWrt/hostapd 组合不启用 `bss_transition`，避免 WiFi 启动失败
- MAC 派生：优先使用 U-Boot `ethaddr`，失效时使用 eMMC CID 稳定兜底；ETH1 / 2.4G WiFi / 5G WiFi 分别使用 `base + 1/+2/+3`
- 有线 WAN 优先：`wan` / `wan6` metric 为 `10`
- 5G SIM 备用：QModem 生成的 `USB` / `USBv6` metric 为 `50`
- 首次启动时清理固件内的 QModem、small_package 和 video 软件源条目

内置 `luci-app-h5000m-netmode`，可在 LuCI 的“网络 / 出口优先级”中切换有线 WAN 和 5G 模块的优先级。

内置 `luci-app-h5000m-fancontrol`，可在 LuCI 的“系统 / 风扇控制”中设置自动、手动和关闭模式，并显示 PWM、模块温度、CPU 温度和 WiFi 温度。

内置 `luci-app-ttyd`，可在 LuCI 中打开 Web 终端，便于刷机后直接执行诊断命令。

内置 `luci-app-mt5700m`，可在 LuCI 的“移动网络 / MT5700M 管理”中打开 MT5700M 管理页面。当前默认通过本机 WebSocket/AT 代理访问模块，状态查询和 AT 调试不会直接抢占 QModem 串口；页面中已包含状态、网络与小区信息、锁频控制、短信中心、系统/FOTA、设置和 AT 终端等功能。

## 本地 Runner

当前 workflow 的本地 runner 下载缓存路径：

```text
/home/builder/openwrt-h5000m-cache/dl
```

为保证稳定复现，当前默认关闭 ccache；如果旧 runner 上还存在 `/home/builder/openwrt-h5000m-cache/ccache`，它只是历史缓存，默认构建不会使用。

如果需要彻底重建本地 runner，建议先在 GitHub 仓库中移除旧 self-hosted runner，再在本地停止旧服务、删除旧 runner 目录和旧缓存目录，然后用新仓库名重新注册。
