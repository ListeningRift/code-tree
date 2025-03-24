import * as vscode from 'vscode'
import { localize } from './i18n'

/* 实现 vscode.TreeDataProvider 的接口 */
export class TreeViewProvider implements vscode.TreeDataProvider<vscode.DocumentSymbol> {
  private symbols: vscode.DocumentSymbol[]
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.DocumentSymbol | undefined | null | void> = new vscode.EventEmitter<vscode.DocumentSymbol | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<vscode.DocumentSymbol | undefined | null | void> = this._onDidChangeTreeData.event

  constructor(symbols: vscode.DocumentSymbol[]) {
    this.symbols = symbols
  }

  /* 获取树视图的每一项item */
  getTreeItem(element: vscode.DocumentSymbol): vscode.TreeItem | Thenable<vscode.TreeItem> {
    // 获取当前元素的层级
    const level = this.getElementLevel(element)

    // 判断是否应该默认展开
    const shouldExpand = (symbol: vscode.DocumentSymbol): boolean => {
      // 只考虑第一层的符号
      if (level > 1)
        return false

      // 需要默认展开的符号类型
      const expandableTypes = [
        vscode.SymbolKind.Namespace,
        vscode.SymbolKind.Module,
        vscode.SymbolKind.Class,
      ]

      return expandableTypes.includes(symbol.kind)
    }

    // 根据符号类型和层级决定折叠状态
    const collapsibleState = element.children?.length
      ? (shouldExpand(element)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed)
      : vscode.TreeItemCollapsibleState.None

    const treeItem = new vscode.TreeItem(
      element.name,
      collapsibleState,
    )

    // 设置图标（根据类型）
    treeItem.iconPath = this.getIconForType(element.kind)

    // 绑定点击跳转命令
    if ((element as any).location) {
      treeItem.command = {
        command: 'codeTree.goToLocation',
        title: localize('command.goToLocation'),
        arguments: [(element as any).location],
      }
    }

    // 添加上下文数据，用于右键菜单
    treeItem.contextValue = 'codeTreeItem'

    // 将符号对象保存到treeItem中，以便在右键菜单命令中使用
    treeItem.tooltip = element.detail || element.name
    treeItem.id = `${element.name}-${element.range.start.line}-${element.range.start.character}`

    return treeItem
  }

  /* 获取树视图的children */
  getChildren(_element?: vscode.DocumentSymbol): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    if (_element) {
      return (_element.children || [])
    }
    return this.symbols
  }

  /* 获取父节点 - 用于reveal方法 */
  getParent(element: vscode.DocumentSymbol): vscode.ProviderResult<vscode.DocumentSymbol> {
    return this.findParent(this.symbols, element)
  }

  // 刷新数据
  refresh(symbols?: vscode.DocumentSymbol[]): void {
    if (symbols)
      this.symbols = symbols
    // 刷新树形视图
    this._onDidChangeTreeData.fire()
  }

  // 获取图标
  private getIconForType(type: vscode.SymbolKind): vscode.ThemeIcon {
    if (type === vscode.SymbolKind.Variable) {
      return new vscode.ThemeIcon('symbol-variable')
    }
    if (type === vscode.SymbolKind.Constant) {
      return new vscode.ThemeIcon('symbol-constant')
    }
    if (type === vscode.SymbolKind.String) {
      return new vscode.ThemeIcon('symbol-string')
    }
    if (type === vscode.SymbolKind.Number) {
      return new vscode.ThemeIcon('symbol-number')
    }
    if (type === vscode.SymbolKind.Boolean) {
      return new vscode.ThemeIcon('symbol-boolean')
    }
    if (type === vscode.SymbolKind.Array) {
      return new vscode.ThemeIcon('symbol-array')
    }
    if (type === vscode.SymbolKind.Object) {
      return new vscode.ThemeIcon('symbol-object')
    }
    if (type === vscode.SymbolKind.Key) {
      return new vscode.ThemeIcon('symbol-key')
    }
    if (type === vscode.SymbolKind.Null) {
      return new vscode.ThemeIcon('symbol-null')
    }
    if (type === vscode.SymbolKind.Property) {
      return new vscode.ThemeIcon('symbol-property')
    }
    if (type === vscode.SymbolKind.Field) {
      return new vscode.ThemeIcon('symbol-field')
    }
    if (type === vscode.SymbolKind.Function) {
      return new vscode.ThemeIcon('symbol-function')
    }
    if (type === vscode.SymbolKind.Method) {
      return new vscode.ThemeIcon('symbol-method')
    }
    if (type === vscode.SymbolKind.Class) {
      return new vscode.ThemeIcon('symbol-class')
    }
    if (type === vscode.SymbolKind.Interface) {
      return new vscode.ThemeIcon('symbol-interface')
    }
    if (type === vscode.SymbolKind.Enum) {
      return new vscode.ThemeIcon('symbol-enum')
    }
    if (type === vscode.SymbolKind.Module) {
      return new vscode.ThemeIcon('symbol-module')
    }
    if (type === vscode.SymbolKind.Namespace) {
      return new vscode.ThemeIcon('symbol-namespace')
    }
    if (type === vscode.SymbolKind.Package) {
      return new vscode.ThemeIcon('symbol-package')
    }
    if (type === vscode.SymbolKind.Constructor) {
      return new vscode.ThemeIcon('symbol-constructor')
    }
    if (type === vscode.SymbolKind.EnumMember) {
      return new vscode.ThemeIcon('symbol-enum-member')
    }
    if (type === vscode.SymbolKind.Event) {
      return new vscode.ThemeIcon('symbol-event')
    }
    if (type === vscode.SymbolKind.File) {
      return new vscode.ThemeIcon('symbol-file')
    }
    return new vscode.ThemeIcon('symbol-namespace')
  }

  // 添加新方法：获取元素的层级
  private getElementLevel(element: vscode.DocumentSymbol): number {
    let level = 1
    let parent = this.findParent(this.symbols, element)

    while (parent) {
      level++
      parent = this.findParent(this.symbols, parent)
    }

    return level
  }

  // 添加新方法：查找父元素
  private findParent(symbols: vscode.DocumentSymbol[], target: vscode.DocumentSymbol): vscode.DocumentSymbol | null {
    for (const symbol of symbols) {
      if (symbol.children?.includes(target)) {
        return symbol
      }
      if (symbol.children) {
        const parent = this.findParent(symbol.children, target)
        if (parent)
          return parent
      }
    }
    return null
  }

  // 展开所有节点
  public expandAll(treeView: vscode.TreeView<vscode.DocumentSymbol>): void {
    const expandNode = async (node: vscode.DocumentSymbol): Promise<void> => {
      await treeView.reveal(node, { expand: true })
      if (node.children) {
        for (const child of node.children) {
          await expandNode(child)
        }
      }
    }

    // 展开所有根节点
    this.symbols.forEach(symbol => expandNode(symbol))
  }
}
