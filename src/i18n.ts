import * as vscode from 'vscode'

// 支持的语言
export enum Language {
  EN = 'en',
  ZH = 'zh-cn',
}

// 获取当前语言
export function getCurrentLanguage(): Language {
  // 获取 VS Code 的显示语言
  const vscodeLanguage = vscode.env.language.toLowerCase()

  // 如果是中文，返回中文
  if (vscodeLanguage.startsWith('zh')) {
    return Language.ZH
  }

  // 默认返回英文
  return Language.EN
}

// 翻译函数 - 使用 VS Code 的 l10n API
export function localize(key: string): string {
  // 使用 VS Code 的 l10n API 获取翻译
  // 这会自动根据当前 VS Code 的语言设置选择合适的翻译
  return vscode.l10n.t(key)
}
