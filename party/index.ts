import type * as Party from "partykit/server";

import { WebSocket } from "partysocket";

const fal_url = "wss://110602490-lcm-sd15-i2i.gateway.alpha.fal.ai/ws";

export default class Server implements Party.Server {
  socket: WebSocket;
  constructor(readonly party: Party.Party) {
    this.socket = new WebSocket(fal_url);
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    function onMessage(event: MessageEvent) {
      console.log("sending");
      conn.send(event.data);
    }
    this.socket.addEventListener("message", onMessage);
    const onCloseOrError = () => {
      this.socket.removeEventListener("message", onMessage);
      this.socket.removeEventListener("close", onCloseOrError);
      this.socket.removeEventListener("error", onCloseOrError);
    };

    conn.addEventListener("close", onCloseOrError);
    conn.addEventListener("error", onCloseOrError);

    // A websocket just connected!
  }

  onMessage(message: string, sender: Party.Connection) {
    this.socket.send(message);
  }
}

Server satisfies Party.Worker;
