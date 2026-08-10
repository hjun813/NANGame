/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMBAT_SERVER_URL?: string;
  readonly VITE_SERVER_URL?: string;
  readonly VITE_ENABLE_DEBUG_COMBAT_COMMANDS?: string;
  readonly VITE_ENABLE_DEBUG_HUD?: string;
  readonly VITE_ENABLE_SPIKE_ROOM?: string;
  readonly VITE_ENABLE_LOCAL_FALLBACK?: string;
  readonly VITE_ENABLE_CHARACTER_ASSET_TEST?: string;
  readonly VITE_CHARACTER_ASSET_TEST_FIGHTER?: string;
}
