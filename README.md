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
- 你当前实机反馈的 `/dev/mmcblk0p2` 内容为全 0，因此即使使用官方 PR 的 EEPROM 读取方式，WiFi 校准仍可能加载失败。这个问题后续需要继续对照官方固件确认校准数据来源，不建议盲目自动写入。
- 有线 MAC 默认通过 `/dev/mmcblk0p1` 的 U-Boot 环境变量 `ethaddr`、`eth1addr` 写入 UCI。

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
- vnStat2 / luci-app-vnstat2：OpenWrt 官方 feeds

勾选 PassWall、MosDNS、HomeProxy 任意一个时，会自动添加 `kenzok8/small-package`。

## GitHub Actions 构建

打开 `构建 openwrt-H5000M 固件` workflow，手动运行。

建议输入：

- `openwrt_ref`: `v25.12.4`
- `runner_type`: `github-hosted` 或 `self-hosted`
- `qmodem`: 默认开启
- `upnp`: 默认开启
- `passwall`: 默认开启
- `homeproxy`: 默认关闭
- `mosdns`: 默认开启，勾选 `luci-app-mosdns`，相关依赖由软件包自动带入
- `vnstat`: 默认开启，勾选 `luci-app-vnstat2`、`vnstat2`、`vnstati2`，用于累计流量统计
- `create_release`: 默认开启
- `make_jobs`: 留空，或填写 `4`、`8` 这类线程数

固件产物来自：

```text
openwrt/bin/targets/mediatek/filogic
```

## 本地构建

请在 Linux、WSL2 或 Linux 编译机上运行：

```sh
bash ./scripts/prepare-source.sh v25.12.4
cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a
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
- WiFi 名称：`H5000M`，默认开启
- WiFi 密码：`1234567890`
- WiFi 区域：`CN`
- 有线 WAN 优先：`wan` / `wan6` metric 为 `10`
- 5G SIM 备用：QModem 生成的 `USB` / `USBv6` metric 为 `50`
- 首次启动时清理固件内的 QModem、small_package 和 video 软件源条目

内置 `luci-app-h5000m-netmode`，可在 LuCI 的“网络 / 出口优先级”中切换有线 WAN 和 5G 模块的优先级。

内置 `luci-app-h5000m-fancontrol`，可在 LuCI 的“系统 / 风扇控制”中设置自动、手动和关闭模式，并显示 PWM、模块温度、CPU 温度和 WiFi 温度。

## 本地 Runner

当前 workflow 的本地 runner 缓存路径：

```text
/home/builder/openwrt-h5000m-cache/dl
/home/builder/openwrt-h5000m-cache/ccache
```

如果需要彻底重建本地 runner，建议先在 GitHub 仓库中移除旧 self-hosted runner，再在本地停止旧服务、删除旧 runner 目录和旧缓存目录，然后用新仓库名重新注册。
