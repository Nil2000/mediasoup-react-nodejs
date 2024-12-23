import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";

export interface User {
  socket: Socket;
  userId: string;
  roomId: string;
}

export class UserManager {
  private users: User[];
  private roomManager: RoomManager;

  constructor() {
    this.users = [];
    this.roomManager = new RoomManager();
  }

  addUserToRoom(socket: Socket, userId: string, roomId: string) {
    this.users.push({ socket: socket, userId, roomId });
    this.roomManager.addUsertoRoom(roomId, { socket, userId, roomId });
  }
}
