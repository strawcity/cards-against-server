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
  ShowCurrentCardResult,
  StartGameResult,
  SubmitCardResult
} from "./types";
import cors from "cors";
import jwt from "jsonwebtoken";
import {
  initializePlayer,
  initializeGameState,
  initializeGameRound,
  submitCardEvent,
  joinGame
} from "./logic/gameLogic";
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

    // Push the game creating player to the game
    game.players.push(initializePlayer(result, socket));

    // Send the game back to the player and return the nickname to save in UI state
    socket.emit("create-game", {
      game: games[gameId],
      nickname: result.nickname
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
      const gameId = result.gameId;
      const game = games[gameId];
      initializeGameRound(game);
    });

    socket.on("submit-card", (result: SubmitCardResult) => {
      const submittedCard = result.submittedCard;
      const playerId = result.playerId;
      const gameId = result.gameId;

      const game = games[gameId];

      submitCardEvent(game, playerId, submittedCard);
      // // Adding submittedCard to game's submitted cards
      // game.submittedCards.push({ player: playerId, card: submittedCard[0] });

      // // Remove card from answerCards array
      // players[playerId].answerCards = players[playerId].answerCards.filter(
      //   (card) => card !== submittedCard[0]
      // );

      // game.players.forEach((player) => {
      //   // If the person is asking the question, they should get the other cards
      //   if (player.isAskingQuestion) {
      //     players[player.playerId].socket.emit("receive-answer-card", {
      //       submittedCards: game.submittedCards
      //     });

      //     // If all cards are submitted, start reviewing
      //   }

      //   if (game.submittedCards.length === game.players.length - 1) {
      //     // If the person is asking the question, they should get the other cards
      //     players[player.playerId].socket.emit("start-card-review");
      //   }
      // });
    });

    socket.on("show-current-answer", (result: ShowCurrentCardResult) => {
      const playerId = result.playerId;
      const answer = result.answer;
      const gameId = result.gameId;
      const game = games[gameId];

      game.players.forEach((player) => {
        players[player.playerId].socket.emit("show-answer", {
          inFocusCard: { player: playerId, answer: answer }
        });
      });
    });

    socket.on("select-winner", (result) => {
      const winningPlayer = result.winningPlayer;
      const gameId = result.gameId;
      const game = games[gameId];

      players[winningPlayer].wonCards++;

      game.players.forEach((player) => {
        if (players[player.playerId].wonCards === 5) {
          game.players.forEach((player) => {
            players[player.playerId].socket.emit("show-game-winner", {
              winningPlayer: playerId
            });
          });
        } else {
          players[player.playerId].socket.emit("show-round-winner", {
            winningPlayer: playerId,
            wonCards: players[player.playerId].wonCards
          });
        }
      });
    });
  });
});
