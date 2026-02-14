# drpy-node MCP Server

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 实现的辅助服务，旨在帮助 AI 助手更方便地维护 `drpy-node` 项目。

通过这个 MCP 服务，AI 可以直接安全地访问项目文件系统、管理爬虫源、检查路由信息、分析日志、查询数据库以及执行基本的运维操作。

## 目录

- [drpy-node MCP Server](#drpy-node-mcp-server)
  - [目录](#目录)
  - [安装与运行](#安装与运行)
    - [1. 安装依赖](#1-安装依赖)
    - [2. 运行服务](#2-运行服务)
  - [客户端配置 (Trae/Claude Desktop)](#客户端配置-traeclaude-desktop)
  - [可用工具 (Tools)](#可用工具-tools)
    - [文件系统操作](#文件系统操作)
    - [爬虫开发与调试 (New)](#爬虫开发与调试-new)
    - [系统维护与监控 (New)](#系统维护与监控-new)
  - [AI 交互示例 (Best Practice)](#ai-交互示例-best-practice)

## 安装与运行

本服务位于项目的 `drpy-node-mcp` 目录下，拥有独立的依赖环境。

### 1. 安装依赖

初次使用前，请确保在 `drpy-node-mcp` 目录下安装了必要的 Node.js 依赖：

```bash
cd drpy-node-mcp
npm install
```

### 2. 运行服务

该服务使用 Stdio 传输协议，通常由支持 MCP 的客户端（如 Claude Desktop、Cursor、VS Code 插件等）自动启动。

如果需要手动调试运行：

```bash
node index.js
```

## 客户端配置 (Trae/Claude Desktop)

要将此 MCP 服务添加到 Trae 或其他支持 MCP 的客户端，请在客户端的 MCP 配置文件（通常是 `config.json`）中添加以下内容：

```json
{
  "mcpServers": {
    "drpy-node-mcp": {
      "command": "node",
      "args": [
        "E:/gitwork/drpy-node/drpy-node-mcp/index.js"
      ]
    }
  }
}
```

> **注意**: 请确保 `args` 中的路径是您本地机器上 `index.js` 的绝对路径。

## 可用工具 (Tools)

本服务提供以下工具供 AI 调用，旨在覆盖项目维护的全生命周期。

### 文件系统操作

*   **`list_directory`**
    *   描述: 列出项目中的文件和目录。
    *   参数: `path` (可选，默认为项目根目录 `.`)
    *   用途: 探索项目结构。

*   **`read_file`**
    *   描述: 读取指定文件的内容（支持自动解密 DS 格式的加密 JS 源文件）。
    *   参数: `path` (必填)
    *   用途: 读取代码、配置文件等。

*   **`write_file`**
    *   描述: 写入内容到文件（自动创建目录）。
    *   参数: `path` (必填), `content` (必填)
    *   用途: 修改代码、新建文件。

*   **`delete_file`**
    *   描述: 删除指定的文件或目录。
    *   参数: `path` (必填)
    *   用途: 清理废弃文件。

### 爬虫开发与调试 (New)

这些工具专门为编写和调试 drpy 爬虫源（JS）设计，赋予 AI 强大的代码理解和验证能力。

*   **`list_sources`**
    *   描述: 列出 `spider/js/` 和 `spider/catvod/` 下的所有源文件。
    *   用途: 快速概览现有爬虫源。

*   **`fetch_spider_url`**
    *   描述: 使用 drpy-node 的请求库 (`req`) 抓取 URL。
    *   参数: `url` (必填), `options` (可选: method, headers, data)
    *   用途: 调试目标网站的连通性、反爬策略（如 Headers 校验）。

*   **`debug_spider_rule`**
    *   描述: 使用 drpy 的解析规则（pdfa/pdfh/pd）解析 HTML 或 URL 内容。
    *   参数: `rule` (规则), `mode` (模式), `html` 或 `url`
    *   用途: 验证选择器（CSS Selector/Regex）是否正确，无需运行完整爬虫。

*   **`validate_spider`**
    *   描述: 验证爬虫源文件的语法和基本结构。
    *   参数: `path` (必填)
    *   用途: 确保编写的代码没有语法错误且包含必要的 `rule` 定义。

*   **`get_spider_template`**
    *   描述: 获取标准的 drpy JS 爬虫模板。
    *   用途: AI 生成新爬虫时的起手式。

*   **`get_drpy_libs_info`**
    *   描述: 获取 drpy 环境中可用的全局函数和库信息（如 `pdfa`, `req`, `CryptoJS` 等）。
    *   用途: 帮助 AI 了解可用的 API 和工具函数。

*   **`check_syntax`**
    *   描述: 通用的 JS 语法检查工具。
    *   参数: `path` (必填)
    *   用途: 快速检查任何 JS 文件的语法正确性。

### 系统维护与监控 (New)

用于项目运行时的状态监控和配置管理。

*   **`read_logs`**
    *   描述: 读取最新的应用程序日志（支持日志轮转）。
    *   参数: `lines` (读取行数，默认 50)
    *   用途: 排查运行时错误、分析系统行为。

*   **`sql_query`**
    *   描述: 对 `database.db` 执行只读 SQL 查询 (SELECT)。
    *   参数: `query` (SQL 语句)
    *   用途: 检查数据库状态、用户数据或缓存记录。

*   **`manage_config`**
    *   描述: 读取或更新项目配置 (`config/env.json`)。
    *   参数: `action` (get/set), `key` (支持点号嵌套), `value`
    *   用途: 动态调整系统参数（如端口、超时设置等）。

*   **`get_routes_info`**
    *   描述: 获取已注册的 Fastify 路由和控制器信息。
    *   用途: 了解系统当前的 API 暴露情况。

*   **`restart_service`**
    *   描述: 重启 drpy-node 服务 (PM2)。
    *   用途: 应用配置更改或代码更新后重启服务。

## AI 交互示例 (Best Practice)

**场景 1：修复爬虫源**
> User: "XX 网站的爬虫好像失效了，列表页解析不到数据。"
> AI Action:
> 1. 调用 `fetch_spider_url` 获取目标网页源码，确认网站是否能访问或有反爬。
> 2. 读取原爬虫代码 (`read_file`)。
> 3. 调用 `debug_spider_rule` 测试原有规则是否还能匹配到内容。
> 4. 如果规则失效，调整规则并再次测试。
> 5. 确认修复后，使用 `write_file` 更新代码。

**场景 2：系统故障排查**
> User: "服务好像报错了，看一下日志。"
> AI Action:
> 1. 调用 `read_logs` 获取最近的错误堆栈。
> 2. 根据错误信息定位相关代码文件。
> 3. 分析并提出修复建议。

**场景 3：配置修改**
> User: "把服务端口改成 3000。"
> AI Action:
> 1. 调用 `manage_config` 读取当前配置，确认键名（如 `port` 或 `server.port`）。
> 2. 调用 `manage_config` (action=set) 更新配置。
> 3. 调用 `restart_service` 使配置生效。
