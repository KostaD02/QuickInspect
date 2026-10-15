export type SourceOrigin =
  'qwik' | 'vue' | 'astro' | 'inspector' | 'react' | 'svelte';

export interface SourceInfo {
  file: string;
  line: number | null;
  column: number | null;
  origin: SourceOrigin;
  mapped: boolean;
}

export type DevServer = 'vite' | 'next' | null;
