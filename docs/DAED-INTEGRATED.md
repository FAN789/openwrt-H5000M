# H5000M daed 集成固件

该构建变体面向需要 daed 的 H5000M。它继续固定在 OpenWrt
`r35346-e9aa5bea9f` 源码，但由于官方镜像没有开启 daed 运行所需的内核 BTF
和 XDP sockets，不能使用官方 ImageBuilder，也不能向官方固件混装其他 ABI
的内核模块。

## 构建边界

- OpenWrt 源码固定为 `e9aa5bea9f`
- 构建命令固定传入 `REVISION=r35346-e9aa5bea9f`，避免浅克隆把发布修订号误算为 `r0`
- 目标固定为 `mediatek/filogic`、`hiveton_h5000m`
- 内核开启 BTF、cgroup BPF、BPF events 和 XDP sockets
- FA880 使用完整 LLVM 14 工具目录 `/usr/lib/llvm-14` 编译并剥离 eBPF 对象
- daed 与所有 kmod 必须在同一棵源码树中一次构建
- 保留官方 H5000M 端口、分区、MAC、EEPROM 和 sysupgrade 实现
- DTS 仅删除三个风扇 cooling-map，CPU 降频、hot、critical 和内核热管理器保持不变
- 不包含 PassWall2、Xray、sing-box 或其他代理管理插件
- 内置经过脱敏审计的全局、DNS、路由和 `proxy` 策略组默认值
- 不包含节点、订阅、UUID、服务器、SNI、用户、JWT 或其他凭据

构建配置种子为 `configs/integrated-daed.seed`，daed 包的 GeoData 依赖替换见
`configs/daed-package.patch`，运行时固定数据路径的补丁见
`configs/daed-runtime.patch`，去除非确定性 Go 模块更新并固定 pnpm 的补丁见
`configs/daed-reproducible.patch`，处理上游递归源码包中已包含 wing 的补丁见
`configs/daed-source-layout.patch`，风扇 PWM 独占所需的最小 DTS 修改见
`configs/h5000m-fan-cooling-map.patch`。daed 原面板会继承 LuCI 的 HTTPS
协议并尝试用 HTTPS 访问仅提供 HTTP 的 2023 端口，因此
`configs/luci-app-daed-dashboard.patch` 会取消混合内容 iframe，改为使用
当前 LuCI 主机地址在新标签打开 HTTP 面板。源码与 feeds 固定版本见
`configs/integrated-daed.env`。生成的系统必须包含
`/etc/h5000m-daed-build`，独立 daed 离线包也会检查该标记，禁止安装到不兼容
内核。

`h5000m-daed-defaults` 源码由独立
[`luci-app-daed-h5000m`](https://github.com/FAN789/luci-app-daed-h5000m)
仓库提供。它只在 `/etc/daed/wing.db` 不存在时写入清洁种子：daed 管理面板默认
启用，代理运行状态保持停止。已有数据库与 sysupgrade 保留配置永远不会被默认值
覆盖。

## GeoData

固件同时内置以下 V2Ray protobuf 格式数据：

- V2Fly 官方 GeoIP 与 GeoSite
- Loyalsoldier 增强 GeoIP 与 GeoSite

GeoIP 与 GeoSite 可分别选择来源。首次启动使用内置文件，无需联网；后续可以在
LuCI 中手动更新，或按天数和时间自动更新。更新过程校验上游 SHA-256，成功后
原子替换；如果正在运行的 daed 无法恢复，会回滚旧文件。

## 产品插件

该变体同时集成 H5000M 风扇管理、MT5700M 模组管理和出口优先级。插件源码仍
保存在各自独立仓库；构建时同步当前确认版本，不在主仓库复制维护。

## 发布前验证

至少检查：

1. sysupgrade 元数据和设备标识为 `hiveton,h5000m`。
2. 内核配置包含 `CONFIG_DEBUG_INFO_BTF=y` 和 `CONFIG_XDP_SOCKETS=y`。
3. 启动后存在 `/sys/kernel/btf/vmlinux`，daed 所需 TC/eBPF 模块可加载。
4. 两套 GeoIP/GeoSite 的版本、大小和 SHA-256 与构建记录一致。
5. daed 管理服务默认启用、代理状态默认停止，种子库的节点、订阅、用户和绑定表为空。
6. LAN/WAN、WiFi、LuCI、风扇、MT5700M、出口切换及 IPv4/IPv6 均完成实体机回归。
