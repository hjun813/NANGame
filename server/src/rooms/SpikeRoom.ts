import { Client, Room } from 'colyseus';

const SPIKE_READY = 'spike_ready';
const SPIKE_REQUEST_STATE = 'spike_request_state';
const SPIKE_STATE = 'spike_state';

interface SpikeStateMessage {
  roomId: string;
  playerCount: number;
  readyCount: number;
  revision: number;
}

/**
 * TV-NET-001/002 검증 전용 방.
 * 실제 경기 상태나 이동 권한 로직은 포함하지 않는다.
 */
export class SpikeRoom extends Room {
  maxClients = 2;
  private readonly readyPlayers = new Set<string>();
  private revision = 0;

  onCreate() {
    this.onMessage(
      SPIKE_READY,
      (client, ready: unknown) => {
        if (typeof ready !== 'boolean') return;

        if (ready) {
          this.readyPlayers.add(client.sessionId);
        } else {
          this.readyPlayers.delete(client.sessionId);
        }
        this.revision++;
        this.broadcastState();
      },
    );
    this.onMessage(SPIKE_REQUEST_STATE, (client) => {
      client.send(SPIKE_STATE, this.createStateMessage());
    });
  }

  onJoin(client: Client) {
    this.revision++;
    // 신규 참가자는 핸들러 등록 후 현재 상태를 직접 요청한다.
    this.broadcast(SPIKE_STATE, this.createStateMessage(), { except: client });
  }

  onLeave(client: Client) {
    this.readyPlayers.delete(client.sessionId);
    this.revision++;
    this.broadcastState();
  }

  private broadcastState() {
    this.broadcast(SPIKE_STATE, this.createStateMessage());
  }

  private createStateMessage(): SpikeStateMessage {
    return {
      roomId: this.roomId,
      playerCount: this.clients.length,
      readyCount: this.readyPlayers.size,
      revision: this.revision,
    };
  }
}
