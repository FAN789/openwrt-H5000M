# ImmortalWrt-H5000M

这是一个用于构建 Hiveton/Airpi H5000M 固件的项目。主源码使用
`immortalwrt/immortalwrt`，构建时可以选择 ImmortalWrt 的分支、标签或提交，
然后自动叠加 H5000M 设备适配。

## 项目做什么

本项目不直接保存完整 ImmortalWrt 源码，而是在构建时完成这些步骤：

1. 按你指定的 ref 拉取 `immortalwrt/immortalwrt`。
2. 应用 H5000M 设备适配，来源参考 ImmortalWrt PR #2166 和 OpenWrt PR #21398。
3. 使用 `configs/h5000m.seed` 选择 MediaTek Filogic / H5000M 目标。
4. 按 workflow 选项集成 QModem、PassWall、MosDNS、UPnP、HomeProxy。
5. 通过 GitHub Actions 或本地 Linux 环境编译固件。

## 版本选择

可以填写任何 ImmortalWrt 存在的 ref：

- `master`
- `v25.12.0`
- `v24.10.6`
- 某个提交 SHA
- 未来发布的标签，例如 `v25.12.4`

截至 2026-06-04，ImmortalWrt 已有 `v25.12.0` 和 `v24.10.6`，但还没有
`v25.12.4`。

注意：H5000M 使用 MediaTek MT7987A。当前这份设备适配要求所选 ImmortalWrt
版本已经包含 MT7987 基础平台文件。创建项目时，`v25.12.0` 包含
`mt7987a.dtsi`，但 `v24.10.6` 不包含；因此 `v24.10.6` 可以作为可选 ref，
但若要真正构建 H5000M，还需要先回移植 MT7987 平台支持。

## GitHub Actions 构建

打开 `构建 H5000M 固件` workflow，手动运行。

建议输入：

- `immortalwrt_ref`: `v25.12.0`
- `runner_type`: `github-hosted` 或 `self-hosted`
- `qmodem`: `true`
- `passwall`、`mosdns`、`mosdns_luci`、`upnp`: 默认开启
- `homeproxy`: 按需开启
- `create_release`: 默认开启
- `make_jobs`: 留空，或填写 `4` 这类线程数

选择 `self-hosted` 时，workflow 会使用你自己的本地 Runner，并跳过 GitHub
托管机专用的依赖安装步骤；请提前在本地 Runner 上准备好 OpenWrt/ImmortalWrt
编译依赖。

固件产物来自：

`openwrt/bin/targets/mediatek/filogic`

## 本地构建

请在 Linux、WSL2 或 Linux 编译机上运行：

```sh
bash ./scripts/prepare-source.sh v25.12.0
cd openwrt
make defconfig
make download -j8
make -j"$(nproc)"
```

尝试其他版本：

```sh
bash ./scripts/prepare-source.sh master
bash ./scripts/prepare-source.sh v24.10.6
```

如果所选版本缺少 MT7987 支持，适配脚本会提前停止并提示缺少的文件。

## 项目结构

- `.github/workflows/build.yml`：手动触发的 GitHub Actions 构建流程。
- `configs/h5000m.seed`：H5000M 基础配置。
- `files/etc/uci-defaults/99-h5000m-defaults`：默认 LAN IP、root 密码、WiFi
  密码、WAN/5G 优先级、接口热插拔修正和软件源清理。
- `patches/optional/`：兼容时才应用的可选补丁。
- `scripts/prepare-source.sh`：拉取 ImmortalWrt、添加 feeds、写入配置。
- `scripts/apply-h5000m.py`：应用 H5000M 设备适配。

## 固件默认设置

- LAN IP：`192.168.10.1`
- root 密码：`admin`
- WiFi 名称：保留默认 `ImmortalWrt`
- WiFi 密码：`1234567890`
- WAN 网线优先：`wan`/`wan6` metric 为 `10`
- 5G SIM 备用：保留 QModem 生成的 `USB`/`USBv6`，并将 QModem
  modem-device 与网络接口 metric 设为 `50`
- 接口热插拔时自动清理旧的 `wan5g`/`wan5g6` 残留，避免重复接口
- 首次启动时删除固件内的 QModem 和 video 软件源条目。

固件内置 `luci-app-h5000m-netmode`，可在 LuCI 的“网络 / H5000M 出口优先级”
中切换：

- 有线 WAN 优先：`wan`/`wan6` metric 为 `10`，`USB`/`USBv6` 和 QModem
  modem-device metric 为 `50`，并关闭 `USBv6` 默认路由。
- 5G 模块优先：`USB`/`USBv6` 和 QModem modem-device metric 为 `10`，
  `wan`/`wan6` metric 为 `50`，并开启 `USBv6` 默认路由。

## 可选软件包

workflow 可以选择集成 QModem、PassWall、MosDNS、UPnP 和 HomeProxy。

启用 `qmodem` 时，会添加 `FUjr/QModem` feed，并安装 QModem Next 路线所需
的相关包：

- 保留：`qmodem`、`luci-app-qmodem-next`、`luci-app-qmodem-monitor`、
  `luci-app-qmodem-ttlfw4`、`qmodem_monitor`、`modem_scan`、
  `ubus-at-daemon`、`tom_modem`、`sms-tool_q`、`sms-forwarder-next`、
  `qfirehose`、`ndisc6`、`quectel-CM-5G-M`、`kmod-pcie_mhi`、
  `kmod-qmi_wwan_q`、`kmod-qmi_wwan_f`、`kmod-qmi_wwan_s`
- 排除：`luci-app-qmodem`、`luci-app-qmodem-sms`、`luci-app-qmodem-ttl`、
  `luci-app-qmodem-mwan`、`luci-app-qmodem-hc`、`sms-forwarder`

PassWall、MosDNS、UPnP 和 HomeProxy 使用 ImmortalWrt 自带 feeds 中的官方包名，
本项目不会为它们添加第三方软件源。

## 可选补丁

`patches/optional/mtwifi-apcli-active-only.patch` 来自
`existyay/Auto-H5000M-BIN`。它修复 MTK `mtwifi-cfg` 在禁用部分 AP/APCLI
VIF 时仍占用 BSSID/interface 计数的问题。

该补丁只在源码结构匹配时自动应用；如果当前 ImmortalWrt 版本不包含对应
`mtwifi-cfg` 文件，脚本会跳过它，不会阻塞普通 H5000M 构建。
