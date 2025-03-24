// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { TreeViewProvider } from './codeTreeView'
import { localize } from './i18n'
import { collapseTreeAll, findSymbolAtCursor, foldAll, foldRegion, goToLocation, shouldHaveSymbols, sortSymbolsByLocation, unfoldAll, unfoldTo } from './utils'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  vscode.commands.executeCommand('setContext', 'codeTree.showVariables', true)
  vscode.commands.executeCommand('setContext', 'codeTree.showFunction', true)

  // 从全局状态中读取光标跟踪状态，如果不存在则默认为false（关闭光标跟踪）
  let isCursorTrackingEnabled = context.globalState.get<boolean>('codeTree.cursorTrackingEnabled', false)
  // 初始化上下文变量
  vscode.commands.executeCommand('setContext', 'codeTree.cursorTrackingEnabled', isCursorTrackingEnabled)

  const treeViewProvider = new TreeViewProvider([])
  const treeView = vscode.window.createTreeView('codeTreeView', { treeDataProvider: treeViewProvider })

  const cache = new Map<vscode.Uri, vscode.DocumentSymbol[]>()
  // 用于防抖处理的计时器
  let debounceTimer: NodeJS.Timeout | undefined

  // 根据光标位置更新树视图选中项
  const updateTreeSelectionByCursor = (): void => {
    // 如果光标跟踪被禁用，则不执行
    if (!isCursorTrackingEnabled)
      return

    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor)
      return

    const cachedSymbols = cache.get(activeEditor.document.uri)
    if (!cachedSymbols)
      return

    const cursorPosition = activeEditor.selection.active
    const symbolAtCursor = findSymbolAtCursor(cachedSymbols, cursorPosition)

    if (symbolAtCursor && treeView.visible) {
      // 选中并展开到对应的节点
      treeView.reveal(symbolAtCursor, { select: true, focus: false, expand: true })
    }
  }

  const refreshTreeView = (useCache = true): void => {
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor) {
      if (useCache) {
        const cachedSymbols = cache.get(activeEditor.document.uri)
        if (cachedSymbols) {
          treeViewProvider.refresh(cachedSymbols)
          // 刷新后更新选中项
          updateTreeSelectionByCursor()
          return
        }
      }
      vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        activeEditor.document.uri,
      ).then((symbols: any) => {
        const sortedSymbols = sortSymbolsByLocation(symbols)
        cache.set(activeEditor.document.uri, sortedSymbols)
        treeViewProvider.refresh(sortedSymbols)
        // 刷新后更新选中项
        updateTreeSelectionByCursor()
      })
    }
  }

  // 等待 LSP 准备就绪后再分析
  const tryRefreshWithDelay = (retries = 3, delay = 1000): void => {
    const activeEditor = vscode.window.activeTextEditor
    if (!shouldHaveSymbols(activeEditor?.document)) {
      refreshTreeView() // 如果文件为空，显示空树
      return
    }

    vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      activeEditor?.document.uri,
    ).then((symbols: any) => {
      if (symbols) {
        refreshTreeView() // 即使是空数组也刷新，因为可能本来就是空文件
      }
      else if (retries > 0) {
        // 只有当完全无法获取符号时才重试
        setTimeout(() => tryRefreshWithDelay(retries - 1, delay), delay)
      }
    })
  }

  // 监听树视图可见性变化
  treeView.onDidChangeVisibility((e) => {
    if (e.visible && vscode.window.activeTextEditor) {
      // 当树视图变为可见时刷新
      tryRefreshWithDelay()
    }
  }, null, context.subscriptions)

  // 监听活动编辑器变化
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && treeView.visible) {
      // 只有当树视图已经可见时才刷新，避免自动切换到插件视图
      refreshTreeView()
    }
  }, null, context.subscriptions)

  // 监听编辑器光标位置变化
  vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.textEditor === vscode.window.activeTextEditor && vscode.window.activeTextEditor?.document) {
      updateTreeSelectionByCursor()
    }
  }, null, context.subscriptions)

  // 监听文档内容变化
  vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && event.document === activeEditor.document && treeView.visible) {
      // 使用防抖处理，避免频繁更新
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        cache.delete(event.document.uri) // 清除缓存
        refreshTreeView(false) // 强制刷新
        debounceTimer = undefined
      }, 500) // 500毫秒的防抖延迟
    }
  }, null, context.subscriptions)

  // 监听文档保存
  vscode.workspace.onDidSaveTextDocument((document) => {
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && document === activeEditor.document && treeView.visible) {
      cache.delete(document.uri) // 清除缓存
      refreshTreeView(false) // 强制刷新
    }
  }, null, context.subscriptions)

  // 注册刷新按钮命令
  const refreshCommand = vscode.commands.registerCommand('codeTree.refreshView', () => {
    cache.clear() // 清除缓存
    tryRefreshWithDelay() // 重新加载
  })

  // 跳转
  const goToLocationCommand = vscode.commands.registerCommand(
    'codeTree.goToLocation',
    goToLocation,
  )

  // 折叠所有
  const foldAllCommand = vscode.commands.registerCommand(
    'codeTree.foldAll',
    foldAll,
  )
  // 展开所有
  const unfoldAllCommand = vscode.commands.registerCommand(
    'codeTree.unfoldAll',
    unfoldAll,
  )
  // 展开至某级
  const unfoldToCommand = vscode.commands.registerCommand(
    'codeTree.unfoldTo',
    unfoldTo,
  )

  // 注册切换光标跟踪的命令
  const toggleCursorTracking = (): void => {
    isCursorTrackingEnabled = !isCursorTrackingEnabled
    // 更新按钮图标
    vscode.commands.executeCommand('setContext', 'codeTree.cursorTrackingEnabled', isCursorTrackingEnabled)
    // 保存到全局状态
    context.globalState.update('codeTree.cursorTrackingEnabled', isCursorTrackingEnabled)
    // 显示状态通知
    vscode.window.showInformationMessage(
      isCursorTrackingEnabled
        ? localize('notification.cursorTrackingEnabled')
        : localize('notification.cursorTrackingDisabled'),
    )

    // 如果开启了跟踪，立即更新选中项
    if (isCursorTrackingEnabled) {
      updateTreeSelectionByCursor()
    }
  }

  const toggleCursorTrackingOnCommand = vscode.commands.registerCommand('codeTree.toggleCursorTrackingOn', toggleCursorTracking)
  const toggleCursorTrackingOffCommand = vscode.commands.registerCommand('codeTree.toggleCursorTrackingOff', toggleCursorTracking)

  // 注册折叠区域命令
  const foldRegionCommand = vscode.commands.registerCommand(
    'codeTree.foldRegion',
    foldRegion,
  )

  // 折叠代码树
  const collapseTreeAllCommand = vscode.commands.registerCommand(
    'codeTree.collapseTreeAll',
    collapseTreeAll,
  )

  // 展开代码树
  const expandTreeAllCommand = vscode.commands.registerCommand(
    'codeTree.expandTreeAll',
    () => {
      treeViewProvider.expandAll(treeView)
    },
  )

  context.subscriptions.push(
    goToLocationCommand,
    refreshCommand,
    foldAllCommand,
    unfoldAllCommand,
    unfoldToCommand,
    toggleCursorTrackingOnCommand,
    toggleCursorTrackingOffCommand,
    foldRegionCommand,
    collapseTreeAllCommand,
    expandTreeAllCommand,
  )
}

// This method is called when your extension is deactivated
export function deactivate(): void {}
