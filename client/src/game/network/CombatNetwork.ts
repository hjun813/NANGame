import { Client, Room } from 'colyseus.js';
import { EVENTS } from '@shared/constants';
import type {
  CombatDamageMessage,
  CombatStateSnapshot,
} from '@shared/health';

export class CombatNetwork {
  public status = 'CONNECTING';
  private room: Room | null = null;
  private disposed = false;

  constructor(
    private readonly onState: (state: CombatStateSnapshot) => void,
  ) {}

  async connect() {
    const endpoint = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
    try {
      const room = await new Client(endpoint).joinOrCreate('combat_room');
      if (this.disposed) {
        await room.leave();
        return;
      }
      this.room = room;
      this.status = 'CONNECTED';
      room.onMessage<CombatStateSnapshot>(EVENTS.COMBAT_STATE, this.onState);
      room.onLeave(() => {
        if (!this.disposed) this.status = 'DISCONNECTED';
      });
      room.onError(() => {
        this.status = 'ERROR';
      });
      room.send(EVENTS.COMBAT_REQUEST_STATE);
    } catch {
      if (!this.disposed) this.status = 'ERROR';
    }
  }

  sendDamage(message: CombatDamageMessage): boolean {
    if (!this.room) return false;
    this.room.send(EVENTS.COMBAT_DAMAGE, message);
    return true;
  }

  reset(): boolean {
    if (!this.room) return false;
    this.room.send(EVENTS.COMBAT_RESET);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.room?.removeAllListeners();
    void this.room?.leave();
    this.room = null;
  }
}
