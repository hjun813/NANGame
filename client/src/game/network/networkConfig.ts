import { getCombatServerUrl } from '@shared/networkConfig';

export const COMBAT_SERVER_URL = getCombatServerUrl(
  import.meta.env.VITE_COMBAT_SERVER_URL ?? import.meta.env.VITE_SERVER_URL,
  {
    pageProtocol: window.location.protocol,
    pageHost: window.location.host,
    isDevelopment: import.meta.env.DEV,
  },
);
