import { Client, Room } from 'colyseus.js';
import { EVENTS } from '@shared/constants';
import type {
  CombatAssignmentMessage,
  CombatAttackMessage,
  CombatDamageMessage,
  CombatPositionMessage,
  CombatStateSnapshot,
} from '@shared/health';

export class CombatNetwork {
  public status: CombatConnectionStatus = 'CONNECTING';
  private room: Room | null = null;
  private disposed = false;
  public assignment: CombatAssignmentMessage | null = null;
  public roomId = '-';
  public sessionId = '-';

  constructor(
    private readonly onState: (state: CombatStateSnapshot) => void,
    private readonly onStatusChange?: (status: CombatConnectionStatus) => void,
    private readonly onAssignmentChange?: (assignment: CombatAssignmentMessage | null) => void,
  ) {}

  private setStatus(status: CombatConnectionStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  async connect() {
    const endpoint = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
    try {
      const room = await new Client(endpoint).joinOrCreate('combat_room');
      if (this.disposed) {
        await room.leave();
        return;
      }
      this.room = room;
      this.setStatus('CONNECTED');
      this.roomId = room.roomId;
      this.sessionId = room.sessionId;
      room.onMessage<CombatStateSnapshot>(EVENTS.COMBAT_STATE, this.onState);
      room.onMessage<CombatAssignmentMessage>(EVENTS.COMBAT_ASSIGNMENT, (assignment) => {
        this.assignment = assignment;
        this.onAssignmentChange?.(assignment);
      });
      room.onLeave(() => {
        if (!this.disposed) {
          this.setStatus('DISCONNECTED');
          this.room = null;
          this.assignment = null;
          this.onAssignmentChange?.(null);
        }
      });
      room.onError(() => {
        this.setStatus('ERROR');
      });
      room.send(EVENTS.COMBAT_REQUEST_STATE);
    } catch {
      if (!this.disposed) this.setStatus('ERROR');
    }
  }

  sendPosition(message: CombatPositionMessage): boolean {
    if (!this.room || !this.assignment) return false;
    this.room.send(EVENTS.COMBAT_POSITION, message);
    return true;
  }

  sendAttack(message: CombatAttackMessage): boolean {
    if (!this.room || !this.assignment) return false;
    this.room.send(EVENTS.COMBAT_ATTACK, message);
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

export type CombatConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
