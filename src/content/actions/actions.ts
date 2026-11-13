import { ElementInfo } from '@/shared/types';
import { bestLocator, toJson, toMarkdown } from '@/shared/util';

export interface CopyAction {
  id: 'selector' | 'xpath' | 'locator' | 'html' | 'text' | 'json' | 'markdown';
  code: string;
  key: string;
  labelKey: string;
  value: (info: ElementInfo, el: Element) => string;
}

export const COPY_ACTIONS: readonly CopyAction[] = [
  {
    id: 'selector',
    code: 'KeyS',
    key: 'S',
    labelKey: 'actionSelector',
    value: (info) => info.selector,
  },
  {
    id: 'xpath',
    code: 'KeyX',
    key: 'X',
    labelKey: 'actionXpath',
    value: (info) => info.xpath,
  },
  {
    id: 'locator',
    code: 'KeyL',
    key: 'L',
    labelKey: 'actionLocator',
    value: (info) => bestLocator(info.locators)?.code ?? info.selector,
  },
  {
    id: 'html',
    code: 'KeyH',
    key: 'H',
    labelKey: 'actionHtml',
    value: (_, el) => el.outerHTML,
  },
  {
    id: 'text',
    code: 'KeyT',
    key: 'T',
    labelKey: 'actionText',
    value: (_, el) => el.textContent.trim(),
  },
  {
    id: 'json',
    code: 'KeyJ',
    key: 'J',
    labelKey: 'actionJson',
    value: (info) => toJson(info),
  },
  {
    id: 'markdown',
    code: 'KeyM',
    key: 'M',
    labelKey: 'actionMarkdown',
    value: (info) => toMarkdown(info),
  },
];

export function actionByCode(code: string): CopyAction | undefined {
  return COPY_ACTIONS.find((action) => action.code === code);
}
