# dsh-wait

> 在 DeepSeek Harness（DSH）Web UI 里发送消息前先确认，避免话没说完就误触发送。

在输入框里按 `Enter` 或点击发送按钮，消息会立即发出。`dsh-wait` 会在真正发送之前弹出一个确认窗口，完整展示即将发送的内容，确认后才发送；取消则保留草稿，继续编辑。

## 功能

- 拦截三种发送方式：`Enter`、`Ctrl/Cmd+Enter`、点击发送按钮
- 弹窗展示完整草稿（超过 4000 字时预览截断，实际仍发送完整内容）
- 取消不丢草稿：`Esc`、点击遮罩或「取消」按钮
- 弹窗内按 `Enter` 或 `Ctrl/Cmd+Enter` 直接确认，点「发送」也可以
- 新会话（hero 输入框）的第一条消息同样会确认
- 忙时排队 / 插话发送同样会确认
- 斜杠命令（以 `/` 开头）不拦截，交给 DSH 自己的命令菜单
- 界面文字跟随 DSH 语言设置（中文 / English）
- 失败开放：插件异常或弹窗未能挂载时不会阻塞发送

## 安装

在 DSH 会话中执行：

```text
plugin_manager action=install_bundle target="dsh-wait"
```

安装后强制刷新页面（`Ctrl+Shift+R`）。

卸载 / 停用：

```text
plugin_manager action=set_bundle target="dsh-wait" enabled=false
```

## 使用

1. 正常输入消息。
2. 按 `Enter`、`Ctrl/Cmd+Enter` 或点发送按钮 —— 不会立即发送，而是弹出确认窗口。
3. 窗口里：
   - `Enter` / `Ctrl/Cmd+Enter` / 点「发送」：确认发送
   - `Esc` / 点遮罩 / 点「取消」：关闭窗口，草稿原样保留
   - `Tab`：在「取消」「发送」之间切换

弹窗默认聚焦「发送」，所以连续按两次 `Enter` 才会发出（第一次拦截并弹窗，第二次确认）。

## 设计

DSH 客户端没有暴露发送拦截 API，因此插件在 `apply` 中安装 document 捕获阶段的 `keydown` / `click` 监听：

- 发送按钮识别为 `[data-composer-card]` 内最后一个 `<button>`，编辑器为卡片内的 `[contenteditable="true"]`
- 确认后重放原始事件（保留 `Ctrl/Cmd` 语义和点击路径），不直接调用 `inputActions.submit()`（后者会强制 queue 模式）
- 弹窗注册在根级 `shell.overlay` 槽位，因此新会话（尚无 session）也能显示
- 守卫只在弹窗组件已挂载时生效；内部异常时放行（fail-open），不会把消息卡住

## 已知限制

- 普通会话中“纯附件、无文字”的发送不会被确认（该位置可能是停止按钮，无法仅凭 DOM 区分）
- 依赖宿主 DOM 结构（`data-composer-card` / `data-composer-overlay` / 按钮顺序）；DSH 改版后守卫可能自动失效（不会报错）
- 通过输入框以外的入口（非 composer）触发的消息不受此插件影响


## License

MIT
