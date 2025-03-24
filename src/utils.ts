import type { TreeViewProvider } from './codeTreeView'
import * as vscode from 'vscode'
import { localize } from './i18n'

/**
 * 按位置对文档符号进行排序
 * @param symbols 文档符号数组
 * @returns 排序后的文档符号数组
 */
export function sortSymbolsByLocation(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  return [...symbols].sort((a, b) => {
    // 先按行号排序
    if (a.range.start.line !== b.range.start.line)
      return a.range.start.line - b.range.start.line

    // 同行按列号排序
    return a.range.start.character - b.range.start.character
  }).map((symbol) => {
    // 递归处理子节点
    if (symbol.children && symbol.children.length > 0)
      symbol.children = sortSymbolsByLocation(symbol.children)
    return symbol
  })
}

/**
 * 光标跳转位置
 * @param location 跳转位置
 */
export function goToLocation(location: vscode.Location): void {
  vscode.window.showTextDocument(location.uri).then((editor) => {
    editor.revealRange(location.range, vscode.TextEditorRevealType.InCenter)
    editor.selection = new vscode.Selection(location.range.start, location.range.start)
  })
}

/**
 * 折叠代码树中所有节点
 */
export function collapseTreeAll(): void {
  // 折叠代码树视图中的所有节点
  vscode.commands.executeCommand('workbench.actions.treeView.codeTreeView.collapseAll')
}

/**
 * 展开代码树中所有节点
 */
export function expandTreeAll(): void {
  // 获取现有的代码树视图
  const existingTreeView = vscode.window.visibleTextEditors
    .find(editor => editor.document.uri.scheme === 'codeTreeView')

  if (existingTreeView) {
    const provider = existingTreeView.document as any as TreeViewProvider
    provider.expandAll(existingTreeView as any)
  }
}

/**
 * 展开至指定层级
 */
export async function unfoldTo(): Promise<void> {
  // 获取用户输入的层级
  const level = await vscode.window.showInputBox({
    prompt: localize('input.unfoldToLevel'),
    placeHolder: localize('input.unfoldToLevelPlaceholder'),
    validateInput: (value: string) => {
      const num = Number.parseInt(value)
      if (Number.isNaN(num) || num < 0 || num > 9)
        return localize('input.unfoldToLevelError')
      return null
    },
  })

  if (level === '0') {
    await vscode.commands.executeCommand('editor.foldAll')
    return
  }

  if (!level)
    return

  // 先全部折叠
  await vscode.commands.executeCommand('editor.foldAll')

  const editor = vscode.window.activeTextEditor
  if (!editor)
    return

  const document = editor.document
  // 获取所有折叠范围
  const foldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[]>('vscode.executeFoldingRangeProvider', document.uri)
  if (!foldingRanges?.length)
    return
  // 根据嵌套层级计算
  const targetRange = foldingRanges.filter((range) => {
    // 计算该range的嵌套层级
    let currentLevel = 1
    for (const parentRange of foldingRanges) {
      if (parentRange.start < range.start && parentRange.end > range.end)
        currentLevel++
    }
    return currentLevel <= Number(level)
  })
  if (!targetRange)
    return

  vscode.commands.executeCommand('editor.unfold', {
    selectionLines: targetRange.map(range => range.start),
  })
}

// 检查文档是否应该有符号信息
export function shouldHaveSymbols(document?: vscode.TextDocument): boolean {
  if (!document)
    return false
    // 检查文件是否为空或只包含空白字符
  return document.getText().trim().length > 0
}

// 查找包含光标位置的符号
export function findSymbolAtCursor(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
  for (const symbol of symbols) {
    if (symbol.range.contains(position)) {
      // 先检查子节点
      if (symbol.children && symbol.children.length > 0) {
        const childSymbol = findSymbolAtCursor(symbol.children, position)
        if (childSymbol) {
          return childSymbol
        }
      }
      // 如果子节点没有匹配的，返回当前节点
      return symbol
    }
  }
  return undefined
}

/**
 * 折叠指定符号对应的区域
 * @param symbol 要折叠的文档符号
 */
export async function foldRegion(symbol: vscode.DocumentSymbol): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor)
    return

  const document = editor.document
  const foldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[]>('vscode.executeFoldingRangeProvider', document.uri)
  if (!foldingRanges?.length)
    return

  // 根据嵌套层级计算
  const targetRange = foldingRanges.filter((range) => {
    return range.start >= (symbol as any).location.range.start.line && range.end <= (symbol as any).location.range.end.line
  })
  if (!targetRange)
    return

  // 折叠编辑器中的代码区域
  vscode.commands.executeCommand('editor.fold', {
    selectionLines: targetRange.map(range => range.start),
  })
}

/**
 * 折叠编辑器中所有可折叠部分
 */
export function foldAll(): void {
  vscode.commands.executeCommand('editor.foldAll')
}

/**
 * 展开编辑器中所有折叠部分
 */
export function unfoldAll(): void {
  vscode.commands.executeCommand('editor.unfoldAll')
}
