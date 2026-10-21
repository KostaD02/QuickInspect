import { EventsInfo } from './events';
import { DevServer, SourceInfo } from './source';

export interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  margin: BoxEdges;
  padding: BoxEdges;
  border: BoxEdges;
  // ? row and column gap of a flex or grid container, null for any other element
  gap: { row: number; column: number } | null;
  // ? the gap areas between items, relative to the element's border box
  gaps: Rect[];
}

export interface StyleEntry {
  property: string;
  value: string;
  color?: string;
}

export interface AttributeEntry {
  name: string;
  value: string;
}

export interface AccessibilityInfo {
  role: string;
  name: string;
  focusable: boolean;
  tabIndex: number | null;
  aria: AttributeEntry[];
}

export interface Locator {
  code: string;
  strategy: LocatorStrategy;
  matches: number;
}

export type LocatorStrategy =
  | 'testId'
  | 'role'
  | 'label'
  | 'placeholder'
  | 'altText'
  | 'title'
  | 'text'
  | 'css';

export interface ContextEntry {
  summary: string;
  depth: number;
}

export interface MediaInfo {
  kind: 'image' | 'video' | 'audio' | 'svg' | 'canvas';
  source: string;
  naturalWidth?: number;
  naturalHeight?: number;
  duration?: number;
  alt?: string;
}

export interface ElementInfo {
  tag: string;
  id: string;
  classes: string[];
  summary: string;
  text: string;
  selector: string;
  xpath: string;
  locators: Locator[];
  box: BoxInfo;
  styles: StyleEntry[];
  accessibility: AccessibilityInfo;
  attributes: AttributeEntry[];
  ancestors: ContextEntry[];
  shadowHost: string | null;
  childCount: number;
  media: MediaInfo | null;
  events: EventsInfo;
  source: SourceInfo | null;
  devServer: DevServer;
}
