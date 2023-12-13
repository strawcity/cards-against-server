import { Socket } from "socket.io";
import { CreateGameResult, Game, JoinGameResult } from "../types";
import { initializeGameState, initializePlayer } from "./gameLogic";
import { guid } from "./utils";

export function createGame(
  result: CreateGameResult,
  socket: Socket,
  game: Game
) {
  // Push the game creating player to the game
  game.players.push(initializePlayer(result, socket));

  // Send the game back to the player and return the nickname to save in UI state
  socket.emit("create-game", {
    game: game,
    nickname: result.nickname
  });
}
