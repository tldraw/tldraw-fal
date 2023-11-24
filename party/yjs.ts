import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class YParty implements Party.Server {
  constructor(public party: Party.Party) {}
  async onConnect(connection: Party.Connection<unknown>): Promise<void> {
    return await onConnect(connection, this.party);
  }
}
