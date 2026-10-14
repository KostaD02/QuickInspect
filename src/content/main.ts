import { loadSettings, logger, watchSettings } from '@/shared/util';
import { Inspector } from './inspector';

const inspector = new Inspector();
inspector.attach();

loadSettings()
  .then((settings) => {
    inspector.setSettings(settings);
  })
  .catch((error: unknown) => {
    logger.warn('Falling back to default settings', error);
  });

watchSettings((settings) => {
  inspector.setSettings(settings);
});
