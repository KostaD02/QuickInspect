import { ElementInfo } from '@/shared/types';
import { bestLocator } from '@/shared/util';

export interface CopyAction {
  id: 'selector' | 'xpath' | 'locator' | 'html' | 'text';
  code: string;
  key: string;
  label: string;
  value: (info: ElementInfo, el: Element) => string;
}

export const COPY_ACTIONS: readonly CopyAction[] = [
  {
    id: 'selector',
    code: 'KeyS',
    key: 'S',
    label: 'selector',
    value: (info) => info.selector,
  },
  {
    id: 'xpath',
    code: 'KeyX',
    key: 'X',
    label: 'XPath',
    value: (info) => info.xpath,
  },
  {
    id: 'locator',
    code: 'KeyL',
    key: 'L',
    label: 'locator',
    value: (info) => bestLocator(info.locators)?.code ?? info.selector,
  },
  {
    id: 'html',
    code: 'KeyH',
    key: 'H',
    label: 'HTML',
    value: (_, el) => el.outerHTML,
  },
  {
    id: 'text',
    code: 'KeyT',
    key: 'T',
    label: 'text',
    value: (_, el) => el.textContent.trim(),
  },
];

export function actionByCode(code: string): CopyAction | undefined {
  return COPY_ACTIONS.find((action) => action.code === code);
}
