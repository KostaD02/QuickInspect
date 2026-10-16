import { SourceInfo } from './source';

export type EventOrigin = 'listener' | 'inline' | 'React' | 'Vue' | 'jQuery';

export interface EventListenerInfo {
  type: string;
  origin: EventOrigin;
  name: string;
  source: string;
  flags: string[];
}

export interface FrameworkInfo {
  name: string;
  component: string;
}

export interface EventsInfo {
  listeners: EventListenerInfo[];
  framework: FrameworkInfo | null;
  source: SourceInfo | null;
}

export const PROBE_EVENT = 'quickinspect:probe';
export const REPLY_EVENT = 'quickinspect:reply';
export const REPLY_ATTRIBUTE = 'data-quickinspect-reply';
export const HANDOVER_EVENT = 'quickinspect:handover';
