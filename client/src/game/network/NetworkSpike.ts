import { Client, Room } from 'colyseus.js';
import { EVENTS } from '@shared/constants';
import { COMBAT_SERVER_URL } from './networkConfig';

interface SpikeStateMessage {
  roomId: string;
  playerCount: number;
  readyCount: number;
  revision: number;
}

export class NetworkSpike {
  public status = 'CONNECTING';
  public roomId = '-';
  public sessionId = '-';
  public playerCount = 0;
  public readyCount = 0;
  public revision = 0;
  public error = '';

  private room: Room | null = null;
  private ready = false;
  private disposed = false;

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'KeyN' || event.repeat || !this.room) return;
    this.ready = !this.ready;
    this.room.send(EVENTS.SPIKE_READY, this.ready);
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  async connect() {
    const endpoint = COMBAT_SERVER_URL;

    try {
      const room = await new Client(endpoint).joinOrCreate('spike_room');
      if (this.disposed) {
        await room.leave();
        return;
      }

      this.room = room;
      this.status = 'CONNECTED';
      this.roomId = room.roomId;
      this.sessionId = room.sessionId;

      room.onMessage<SpikeStateMessage>(EVENTS.SPIKE_STATE, (state) => {
        this.roomId = state.roomId;
        this.playerCount = state.playerCount;
        this.readyCount = state.readyCount;
        this.revision = state.revision;
      });
      room.onLeave(() => {
        if (!this.disposed) this.status = 'DISCONNECTED';
      });
      room.onError((_code, message) => {
        this.status = 'ERROR';
        this.error = message || 'Colyseus room error';
      });
      room.send(EVENTS.SPIKE_REQUEST_STATE);
    } catch (error) {
      if (this.disposed) return;
      this.status = 'ERROR';
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.room?.removeAllListeners();
    void this.room?.leave();
    this.room = null;
  }
}
