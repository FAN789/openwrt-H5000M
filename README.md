# openwrt-H5000M

这是一个用于构建 Hiveton/Airpi H5000M 固件的项目。主源码固定使用 OpenWrt 官方仓库 `openwrt/openwrt`，默认版本为 `v25.12.4`，构建时自动叠加 H5000M 设备适配和可选插件。

## 项目做什么

1. 拉取指定版本的 OpenWrt 官方源码。
2. 应用 H5000M 设备适配：DTS、镜像定义、网络、升级、WiFi MAC、LED、风扇和默认配置。
3. 使用 `configs/h5000m.seed` 选择 MediaTek Filogic / H5000M 目标。
4. 按 workflow 选项集成 QModem、PassWall、MosDNS、UPnP、HomeProxy。
5. 通过 GitHub Actions 或本地 Linux runner 编译固件。

## 插件来源

- QModem：`FUjr/QModem`
- PassWall：`kenzok8/small-package`
- MosDNS / luci-app-mosdns：`kenzok8/small-package`
- HomeProxy：`kenzok8/small-package`
- UPnP：OpenWrt 官方 feeds

勾选 PassWall、MosDNS、HomeProxy 任意一个时，会自动添加 `kenzok8/small-package`。`small_package` 选项用于额外追加整个插件库。

## GitHub Actions 构建

打开 `构建 openwrt-H5000M 固件` workflow，手动运行。

建议输入：

- `openwrt_ref`: `v25.12.4`
- `runner_type`: `github-hosted` 或 `self-hosted`
- `qmodem`: 默认开启
- `upnp`: 默认开启
- `passwall`: 默认关闭
- `homeproxy`: 默认关闭
- `mosdns`: 默认关闭，包含 mosdns 本体和 luci-app-mosdns
- `small_package`: 按需开启
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
- WiFi 名称：保留 OpenWrt 默认名称
- WiFi 密码：`1234567890`
- 有线 WAN 优先：`wan`/`wan6` metric 为 `10`
- 5G SIM 备用：QModem 生成的 `USB`/`USBv6` metric 为 `50`
- 首次启动时清理固件内的 QModem 和 video 软件源条目

内置 `luci-app-h5000m-netmode`，可在 LuCI 的“网络 / 路由器出口优先级”中切换有线 WAN 和 5G 模块的优先级。

内置 `luci-app-h5000m-fancontrol`，可在 LuCI 的“服务 / 风扇控制”中设置自动、手动和关闭模式，并显示 PWM、模块温度、CPU 温度和 WiFi 温度。

## 本地 Runner

当前 workflow 的本地 runner 缓存路径已切换为：

```text
/home/builder/openwrt-h5000m-cache/dl
/home/builder/openwrt-h5000m-cache/ccache
```

如果需要彻底重建本地 runner，建议先在 GitHub 仓库中移除旧 self-hosted runner，再在本地停止旧服务、删除旧 runner 目录和旧缓存目录，然后用新仓库名重新注册。
