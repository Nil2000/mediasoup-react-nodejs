import { Router } from "mediasoup/node/lib/RouterTypes";
import { User } from "./userManager";
import { createWorker } from "../utils/worker";
import { Socket } from "socket.io";

export interface Room {
  users: User[];
  router: Router;
}

let worker = createWorker();

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
  }

  async createRoom(roomId: string) {
    const router = await (await worker).createRouter();
    this.rooms.set(roomId, { users: [], router });
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  async addUsertoRoom(roomId: string, user: User) {
    let room = this.rooms.get(roomId);
    if (!room) {
      await this.createRoom(roomId);
      room = this.rooms.get(roomId);
    }
    room?.users.push(user);
  }

  removeUserFromRoom(roomId: string, userId: string) {
    let room = this.rooms.get(roomId);
    if (!room) {
      console.log("Room not found");
      return;
    }
    room.users = room.users.filter((user) => user.userId !== userId);

    if (room.users.length === 0) {
      room.router.close();
      this.rooms.delete(roomId);
    }
  }
}
