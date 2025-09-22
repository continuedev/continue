# Continue Telemetry 事件类型总结

## 📊 当前定义的事件类型

### 🔧 **核心系统事件**

#### 1. **扩展生命周期事件**

- `vscode_extension_activation_error` - VSCode扩展激活错误
- `unsupported_platform_activation_attempt` - 不支持平台激活尝试

#### 2. **错误处理事件**

- `extension_error_caught` - 扩展错误捕获
- `webview_protocol_error` - WebView协议错误
- `core_messenger_error` - 核心消息传递错误
- `stream_premature_close_error` - 流过早关闭错误

### 💬 **聊天相关事件**

#### 1. **聊天交互**

- `chat` - 聊天对话
- `useSlashCommand` - 使用斜杠命令
- `gui_stream_error` - GUI流错误
- `userInput` - 用户输入
- `step run` - 步骤运行
- `apiRequest` - API请求
- `sessionStart` - 会话开始

#### 2. **工具调用**

- `gui_tool_call_decision` - GUI工具调用决策
- `gui_tool_call_outcome` - GUI工具调用结果

### 🤖 **自动补全事件**

#### 1. **自动补全事件（增强版）**

- `autocomplete` - 自动补全事件（包含所有相关信息）
  - `accepted`: 是否被接受
  - `cacheHit`: 是否命中缓存
  - `completionId`: 补全ID
  - `completionOptions`: 补全选项
  - `debounceDelay`: 防抖延迟
  - `fileExtension`: 文件扩展名
  - `maxPromptTokens`: 最大提示词token数
  - `modelName`: 模型名称
  - `modelProvider`: 模型提供商
  - `multilineCompletions`: 多行补全设置
  - `time`: 处理时间
  - `useRecentlyEdited`: 是否使用最近编辑的代码
  - `numLines`: 补全行数
  - `enabledStaticContextualization`: 是否启用静态上下文化
  - **新增字段**：
    - `completionLength`: 补全长度
    - `prefixLength`: 前缀长度
    - `suggestionDisplayTime`: 建议显示时间（毫秒）
    - `completion`: 完整的补全内容
    - `gitRepo`: Git仓库路径
    - `uniqueId`: 唯一标识符
    - `timestamp`: 时间戳
    - `filepath`: 文件路径

#### 2. **手动输入统计事件**

- `manual_typing_batch` - 手动输入统计批次事件
  - `events`: 手动输入事件数组（简化版，只包含时间戳、字符数、行数）
  - `totalCharactersTyped`: 总输入字符数
  - `totalLinesTyped`: 总输入行数
  - `totalKeystrokes`: 总按键次数
  - `lastTypingTime`: 最后输入时间
  - `eventCount`: 事件数量
  - `batchTimestamp`: 批次时间戳
  - **批量策略**: 每100个事件或5分钟间隔触发上报

### ✏️ **编辑相关事件**

#### 1. **内联编辑**

- `inlineEdit` - 内联编辑（在代码中定义但未找到实际使用）
  - `type`: 编辑类型
  - `prefix`: 前缀
  - `highlighted`: 高亮部分
  - `suffix`: 后缀
  - `input`: 输入
  - `language`: 语言

#### 2. **快速编辑**

- `quickEditSelection` - 快速编辑选择

#### 3. **NextEdit**

- `nextEditOutcome` - NextEdit结果

### 🔧 **配置和上下文事件**

#### 1. **配置管理**

- `config_reload` - 配置重新加载
- `VSCode Quick Actions Settings Changed` - VSCode快速操作设置更改

#### 2. **上下文提供者**

- `context_provider_get_context_items` - 上下文提供者获取上下文项
- `useContextProvider` - 使用上下文提供者

### 📚 **文档和索引事件**

#### 1. **文档管理**

- `docs_pages_crawled` - 文档页面爬取
- `add_docs_config` - 添加文档配置
- `add_docs_gui` - GUI添加文档
- `rebuild_index_clicked` - 重建索引点击

### 🎯 **用户界面事件**

#### 1. **页面浏览**

- `$pageview` - 页面浏览

#### 2. **用户交互**

- `toggle_bookmarked_slash_command` - 切换书签斜杠命令
- `gui_use_active_file_enter` - GUI使用活动文件回车
- `Onboarding Step` - 入门步骤
- `onboardingSelection` - 入门选择

### 📊 **性能和资源事件**

#### 1. **Token使用**

- `tokens_generated_batch` - Token生成批次

#### 2. **检索错误**

- `reranker_fts_retrieval` - 重排序器FTS检索错误
- `reranker_embeddings_retrieval` - 重排序器嵌入检索错误
- `reranker_recently_edited_retrieval` - 重排序器最近编辑检索错误
- `reranker_repo_map_retrieval` - 重排序器仓库映射检索错误
- `no_reranker_fts_retrieval` - 无重排序器FTS检索错误
- `no_reranker_embeddings_retrieval` - 无重排序器嵌入检索错误
- `no_reranker_recently_edited_retrieval` - 无重排序器最近编辑检索错误
- `no_reranker_repo_map_retrieval` - 无重排序器仓库映射检索错误

### 🎮 **命令事件**

#### 1. **VSCode命令**

- `acceptDiff` - 接受差异
- `rejectDiff` - 拒绝差异
- `acceptVerticalDiffBlock` - 接受垂直差异块
- `rejectVerticalDiffBlock` - 拒绝垂直差异块
- `quickFix` - 快速修复
- `defaultQuickAction` - 默认快速操作
- `customQuickActionSendToChat` - 自定义快速操作发送到聊天
- `customQuickActionStreamInlineEdit` - 自定义快速操作流式内联编辑
- `focusEdit` - 聚焦编辑
- `exitEditMode` - 退出编辑模式
- `generateRule` - 生成规则
- `writeCommentsForCode` - 为代码写注释
- `writeDocstringForCode` - 为代码写文档字符串
- `fixCode` - 修复代码
- `optimizeCode` - 优化代码
- `fixGrammar` - 修复语法
- `viewLogs` - 查看日志
- `debugTerminal` - 调试终端
- `addModel` - 添加模型
- `forceReport` - 强制报告
- `toggleTabAutocompleteEnabled` - 切换标签页自动补全启用
- `forceAutocomplete` - 强制自动补全
- `openTabAutocompleteConfigMenu` - 打开标签页自动补全配置菜单
- `enterEnterpriseLicenseKey` - 输入企业许可证密钥
- `toggleNextEditEnabled` - 切换NextEdit启用
- `forceNextEdit` - 强制NextEdit

#### 2. **CLI命令**

- `cliCommand` - CLI命令（包含具体命令：cn, login, logout, ls, serve, remote-test等）

#### 3. **IntelliJ命令**

- `jetbrains_core_exit` - JetBrains核心退出
- `jetbrains_core_start_error` - JetBrains核心启动错误

## 📋 **事件属性结构**

### 通用属性

所有事件都包含以下通用属性：

- `os`: 操作系统
- `extensionVersion`: 扩展版本
- `ideName`: IDE名称
- `ideType`: IDE类型

### 特定事件属性

#### 自动补全事件（增强版）

```typescript
interface AutocompleteEvent {
  // 原有字段
  accepted: boolean;
  cacheHit: boolean;
  completionId: string;
  completionOptions: any;
  debounceDelay: number;
  fileExtension: string;
  maxPromptTokens: number;
  modelName: string;
  modelProvider: string;
  multilineCompletions: "always" | "never" | "auto";
  time: number;
  useRecentlyEdited: boolean;
  numLines: number;
  enabledStaticContextualization?: boolean;

  // 新增字段
  completionLength: number;
  prefixLength: number;
  suggestionDisplayTime?: number;
  completion: string;
  gitRepo?: string;
  uniqueId: string;
  timestamp: string;
  filepath: string;
}
```

#### 聊天事件

```typescript
interface ChatEvent {
  model: string;
  provider: string;
}
```

#### 斜杠命令事件

```typescript
interface SlashCommandEvent {
  name: string;
}
```

## 🔄 **事件上报流程**

### 1. **事件捕获**

```typescript
// 通过Telemetry.capture捕获
await Telemetry.capture("eventName", properties);
```

### 2. **双重上报**

- **PostHog**: 原有的分析平台
- **Shihuo**: 新增的内部统计平台

### 3. **批量处理**

- 每5分钟自动上报一次
- 达到10个事件时立即上报
- 失败时自动重试3次

## 📊 **事件统计**

### 按类别统计

- **系统事件**: 6个（扩展生命周期2个 + 错误处理4个）
- **聊天事件**: 9个（聊天交互7个 + 工具调用2个）
- **自动补全事件**: 1个（已增强）
- **编辑事件**: 3个
- **配置事件**: 4个
- **文档事件**: 4个
- **UI事件**: 5个
- **性能事件**: 1个
- **检索错误事件**: 8个
- **命令事件**: 30个（VSCode命令26个 + CLI命令1个 + IntelliJ命令2个 + 其他命令1个）

### 总计

约 **69+** 个不同的事件类型，涵盖了Continue的所有主要功能模块。

## ⚠️ **文档验证结果**

### ✅ **已验证正确的事件**

- **自动补全事件**：`autocomplete`（已增强，包含原interaction字段）
- **聊天事件**：`chat`, `useSlashCommand`, `gui_stream_error`, `userInput`, `step run`, `apiRequest`, `sessionStart`
- **工具调用事件**：`gui_tool_call_decision`, `gui_tool_call_outcome`
- **编辑事件**：`quickEditSelection`, `nextEditOutcome`
- **配置事件**：`config_reload`, `VSCode Quick Actions Settings Changed`, `context_provider_get_context_items`, `useContextProvider`
- **文档事件**：`docs_pages_crawled`, `add_docs_config`, `add_docs_gui`, `rebuild_index_clicked`
- **UI事件**：`$pageview`, `toggle_bookmarked_slash_command`, `gui_use_active_file_enter`, `Onboarding Step`, `onboardingSelection`
- **性能事件**：`tokens_generated_batch`
- **检索错误事件**：8个reranker相关事件
- **错误处理事件**：`extension_error_caught`, `webview_protocol_error`, `core_messenger_error`, `stream_premature_close_error`
- **命令事件**：30个VSCode/CLI/IntelliJ命令事件

### ❌ **需要修正的事件**

- `install`, `deactivate` - 在代码中未找到实际使用（已从文档中移除）
- `configValidationError` - 在代码中未找到实际使用（已从文档中移除）
- `inlineEdit` - 在代码中定义但未找到实际使用（已标注）

### 📊 **事件上报流程验证**

- ✅ 双重上报（PostHog + Shihuo）正确
- ✅ 批量处理配置正确（5分钟间隔，10个事件触发，3次重试）

这些事件类型确保了Continue能够全面了解用户的使用情况，为产品改进提供数据支持。
