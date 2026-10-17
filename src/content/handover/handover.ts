import { HANDOVER_EVENT } from '@/shared/types/events';

export function claimPage(release: () => void): void {
  document.dispatchEvent(new CustomEvent(HANDOVER_EVENT));
  const onHandover = () => {
    document.removeEventListener(HANDOVER_EVENT, onHandover);
    release();
  };
  document.addEventListener(HANDOVER_EVENT, onHandover);
}
