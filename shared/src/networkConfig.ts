export interface CombatServerUrlOptions {
  pageProtocol: string;
  pageHost: string;
  isDevelopment: boolean;
}

/** 브라우저 환경과 배포 설정을 안전한 Colyseus WebSocket URL로 정규화한다. */
export function getCombatServerUrl(
  configuredUrl: string | undefined,
  options: CombatServerUrlOptions,
): string {
  const fallback = options.isDevelopment
    ? 'ws://localhost:2567'
    : `${options.pageProtocol === 'https:' ? 'wss' : 'ws'}://${options.pageHost}`;
  const candidate = configuredUrl?.trim() || fallback;

  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (options.pageProtocol === 'https:' && url.protocol === 'ws:') {
      url.protocol = 'wss:';
    }
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return fallback;
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}
