import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";

export interface Peer {
  socket: Socket;
  displayName?: string;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}

export class UserManager {
  private peers: Map<string, Peer>;
  private roomManager: RoomManager;

  constructor() {
    this.peers = new Map();
    this.roomManager = new RoomManager();
    console.log("User Manager initialized");
  }

  handlePeer(socket: Socket, displayName: string) {
    const newPeer: Peer = {
      socket,
      displayName,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    this.peers.set(socket.id, newPeer);
    console.log("New peer connected");
  }

  removePeer(socketId: string) {
    //Close all transports, producers and consumers
    if (this.peers.has(socketId)) {
      this.peers.delete(socketId);
      console.log("Peer removed");
    }
  }

  // addUserToRoom(socket: Socket, userId: string, roomId: string) {
  //   this.users.push({ socket: socket, userId, roomId });
  //   this.roomManager.addUsertoRoom(roomId, { socket, userId, roomId });
  // }
}
