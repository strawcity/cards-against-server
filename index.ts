import express, { Request, Response } from "express";
import http from "http";
import { config } from "./config";
import { Socket, Server as SocketIOServer } from "socket.io";
import {
  CreateGameResult,
  Game,
  GameState,
  JoinGameResult,
  Player,
  SelectWinnerResult,
  ShowCurrentCardResult,
  StartGameResult,
  SubmitCardResult
} from "./types";
import cors from "cors";
import jwt from "jsonwebtoken";
import {
  initializePlayer,
  initializeGameState,
  joinGame
} from "./logic/gameLogic";
import { submitCardEvent } from "./logic/submitCardEvent";
import { showCurrentAnswer } from "./logic/showCurrentAnswer";
import { startGameRound } from "./logic/startGameRound";
import { selectWinner } from "./logic/selectWinner";
import { distributeCards, guid } from "./logic/utils";
import { answers, questions } from "./cards/data";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.CORS_ALLOW
  }
});

const players: {
  [key: string]: Player;
} = {};
const games: {
  [key: string]: Game;
} = {};
const thirtyMinutes = 30 * 60 * 1000;

setInterval(() => {
  const currentTime = Date.now();
  for (const game in games) {
    if (currentTime - games[game].timestamp > 30000) {
      delete games[game];
    }
  }
  for (const player in players) {
    if (currentTime - players[player].timestamp > 30000) {
      delete players[player];
    }
  }
}, thirtyMinutes);

app.get(
  "/connect",
  cors({
    origin: config.CORS_ALLOW
  }),
  (req: Request, res: Response) => {
    const user = {
      id: guid()
    }; // Generate a unique ID
    const token = jwt.sign(user, "your-secret-key");
    res.json({
      token
    });
  }
);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  jwt.verify(token, "your-secret-key", (err: any, user: any) => {
    if (err) {
      return next(new Error("invalid"));
    }
    (socket as any).user = user;
    next();
  });
});

io.on("connection", (socket) => {
  const playerId = guid();
  players[playerId] = initializePlayer({ nickname: "", playerId: "" }, socket);
  // You have connected to the game and can enter in your nickname
  socket.emit("connected", playerId);

  // If you do not have a room code, you need to create a game room
  socket.on("create-game", (result: CreateGameResult) => {
    // Create gameId
    const gameId = guid();
    const game = initializeGameState(gameId);
    games[gameId] = game;

    // Push game to server game state
    // Push the game creating player to the game
    game.players.push(initializePlayer(result, socket));

    // Send the game back to the player and return the nickname to save in UI state
    socket.emit("create-game", {
      game: games[gameId],
      nickname: result.nickname
    });
  });

  socket.on("join-game", (result: JoinGameResult) => {
    // Expects a playerId and a nickname, returns a game and a list of players
    // const player = players[playerId];
    const game = games[result.gameId];

    if (game === undefined) {
      socket.emit("no-game", "No game found");
      return;
    }

    if (game.players.length > 6) {
      //sorry max players reach
      return;
    }

    joinGame(game, result, socket);
  });

  socket.on("start-game", (result: StartGameResult) => {
    startGameRound(games[result.gameId]);
  });

  socket.on("submit-card", (result: SubmitCardResult) => {
    submitCardEvent(games[result.gameId], result);
  });

  socket.on("show-current-answer", (result: ShowCurrentCardResult) => {
    showCurrentAnswer(result, games[result.gameId]);
  });

  socket.on("select-winner", (result: SelectWinnerResult) => {
    selectWinner(result, games[result.gameId]);
  });
});
