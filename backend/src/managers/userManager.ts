import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";

export interface User {
  socket: Socket;
  userId: string;
  displayName?: string;
  device?: string;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}

export class UserManager {
  private users: User[];
  private roomManager: RoomManager;

  constructor() {
    this.users = [];
    this.roomManager = new RoomManager();
    console.log("User Manager initialized");
  }

  handleNewUser(socket: Socket, userId: string) {
    const newUser = {
      socket,
      userId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    this.users.push(newUser);
  }

  // addUserToRoom(socket: Socket, userId: string, roomId: string) {
  //   this.users.push({ socket: socket, userId, roomId });
  //   this.roomManager.addUsertoRoom(roomId, { socket, userId, roomId });
  // }
}
