const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function parseAllowedOrigins(
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): string[] {
  const configured = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return configured.length > 0
    ? [...new Set(configured)]
    : nodeEnv === 'production' ? [] : LOCAL_DEVELOPMENT_ORIGINS;
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
  nodeEnv = process.env.NODE_ENV,
): boolean {
  if (!origin) return nodeEnv !== 'production';
  return allowedOrigins.includes(origin.replace(/\/$/, ''));
}

export function isSpikeRoomEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV !== 'production' && environment.ENABLE_SPIKE_ROOM === 'true';
}
