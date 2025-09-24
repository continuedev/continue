#!/bin/bash

# Continue VSCode 扩展更新脚本
# 使用方法: ./update-vscode-extension.sh [quick|full]

set -e  # 遇到错误时停止

echo "🔄 开始更新 Continue VSCode 扩展..."

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# 检查更新类型
UPDATE_TYPE="${1:-quick}"

echo "📍 项目根目录: $PROJECT_ROOT"
echo "🎯 更新类型: $UPDATE_TYPE"

cd "$PROJECT_ROOT"

if [ "$UPDATE_TYPE" = "full" ]; then
    echo "🔨 执行完整构建..."
    
    # 1. 构建所有依赖包
    echo "📦 构建依赖包..."
    cd packages/config-types && npm run build
    cd ../fetch && npm run build  
    cd ../llm-info && npm run build
    cd ../openai-adapters && npm run build
    cd ../terminal-security && npm run build
    cd ../config-yaml && npm run build
    
    # 2. 构建 core
    echo "🏗️ 构建 core 模块..."
    cd ../../core && npm run build
    
    # 3. 构建 GUI
    echo "🎨 构建 GUI..."
    cd ../gui && npm run build
    
    # 4. 构建和打包扩展
    echo "📱 构建 VSCode 扩展..."
    cd ../extensions/vscode
    npm run package
    
elif [ "$UPDATE_TYPE" = "quick" ]; then
    echo "⚡ 执行快速构建..."
    
    # 只重新构建 GUI 和扩展
    echo "🎨 重新构建 GUI..."
    cd gui && npm run build
    
    echo "📱 重新构建 VSCode 扩展..."
    cd ../extensions/vscode
    npm run package
    
else
    echo "❌ 未知的更新类型: $UPDATE_TYPE"
    echo "使用方法: $0 [quick|full]"
    exit 1
fi

echo "✅ VSCode 扩展更新完成!"
echo "📦 VSIX 文件位置: $PROJECT_ROOT/extensions/vscode/build/continue-1.3.9.vsix"
echo ""
echo "安装方法:"
echo "  方法1: code --install-extension $PROJECT_ROOT/extensions/vscode/build/continue-1.3.9.vsix"
echo "  方法2: 在 VSCode 中按 Cmd+Shift+P，输入 'Extensions: Install from VSIX'，选择上述文件"
echo ""
echo "🔄 如需重新加载扩展，请在 VSCode 中按 Cmd+Shift+P，输入 'Developer: Reload Window'"
