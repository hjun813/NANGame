import { Client, Room } from 'colyseus.js';
import { EVENTS } from '@shared/constants';
import type {
  CombatAssignmentMessage,
  CombatDamageMessage,
  CombatPositionMessage,
  CombatStateSnapshot,
} from '@shared/health';

export class CombatNetwork {
  public status = 'CONNECTING';
  private room: Room | null = null;
  private disposed = false;
  public assignment: CombatAssignmentMessage | null = null;
  public roomId = '-';
  public sessionId = '-';

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
      this.roomId = room.roomId;
      this.sessionId = room.sessionId;
      room.onMessage<CombatStateSnapshot>(EVENTS.COMBAT_STATE, this.onState);
      room.onMessage<CombatAssignmentMessage>(EVENTS.COMBAT_ASSIGNMENT, (assignment) => {
        this.assignment = assignment;
      });
      room.onLeave(() => {
        if (!this.disposed) {
          this.status = 'DISCONNECTED';
          this.room = null;
          this.assignment = null;
        }
      });
      room.onError(() => {
        this.status = 'ERROR';
      });
      room.send(EVENTS.COMBAT_REQUEST_STATE);
    } catch {
      if (!this.disposed) this.status = 'ERROR';
    }
  }

  sendPosition(message: CombatPositionMessage): boolean {
    if (!this.room || !this.assignment) return false;
    this.room.send(EVENTS.COMBAT_POSITION, message);
    return true;
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
