import { config } from "./config";
import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { answers, questions } from "./cards/data";
import cors from "cors";

// ...

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.CORS_ALLOW
  }
});

interface Player {
  timestamp: number;
  playerId: string;
  nickname: string;
  isAskingQuestion: boolean;
  wonCards: number;
  answerCards: string[];
  socket?: any; // Update this type based on your Socket.IO socket type
}

interface Game {
  timestamp: number;
  id: string;
  players: Player[];
  submittedCards: { player: string; card: string }[];
  playerRotationPosition: number;
  questionCard: string[];
  answerCards?: string[];
  questionCards?: string[];
}

const players: { [key: string]: Player } = {};
const games: { [key: string]: Game } = {};
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
  cors({ origin: config.CORS_ALLOW }),
  (req: Request, res: Response) => {
    const user = { id: guid() }; // Generate a unique ID
    const token = jwt.sign(user, "your-secret-key");
    res.json({ token });
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
  players[playerId] = {
    timestamp: Date.now(),
    playerId,
    nickname: "",
    isAskingQuestion: false,
    wonCards: 0,
    answerCards: [],
    socket
  };

  socket.emit("connected", playerId);

  socket.on("create-game", (result: any) => {
    const playerId = result.playerId;
    const player = players[playerId];
    player.nickname = result.nickname;

    const gameId = guid();
    games[gameId] = {
      timestamp: Date.now(),
      id: gameId,
      players: [],
      submittedCards: [],
      playerRotationPosition: 0,
      questionCard: []
    };

    const game = games[gameId];

    game.players.push({
      playerId: player.playerId,
      nickname: player.nickname,
      timestamp: Date.now(),
      isAskingQuestion: false,
      wonCards: 0,
      answerCards: []
    });

    socket.emit("create-game", {
      game: games[gameId],
      nickname: result.nickname
    });
  });

  socket.on("join-game", (result) => {
    // Expects a playerId and a nickname, returns a game and a list of players
    const playerId = result.playerId;
    const gameId = result.gameId;
    const player = players[playerId];
    const game = games[gameId];

    if (game === undefined) {
      socket.emit("no-game", "No game found");
      return;
    }

    if (game.players.length > 6) {
      //sorry max players reach
      return;
    }

    // Save player nickname
    player.nickname = result.nickname;

    // Add player to game

    game.players.push({
      playerId: player.playerId,
      nickname: player.nickname,
      timestamp: Date.now(),
      isAskingQuestion: false,
      wonCards: 0,
      answerCards: []
    });

    game.players.forEach((player) => {
      players[player.playerId].socket.emit("join-game", {
        game: games[gameId],
        nickname: result.nickname
      });
    });
  });

  socket.on("start-game", (result) => {
    console.log("🚀 ~ socket.on ~ result:", result);
    const gameId = result.gameId;
    const game = games[gameId];
    // if (socket.id !== gameId) {
    //   return socket.emit("error", "You are not the game owner");
    // }

    game.answerCards = answers;
    game.questionCards = questions;

    // The initial position is 0 for 'start-game'
    game.playerRotationPosition = 0;
    game.players[game.playerRotationPosition].isAskingQuestion = true;

    // Everyone gets to see the question card
    game.questionCard = distributeCards(game.questionCards, 1);
    console.log("🚀 ~ game.players.forEach ~ game.players:", game.players);

    game.players.forEach((player, index) => {
      console.log("🚀 ~ game.players.forEach ~ player:", player);
      game.players[index].isAskingQuestion =
        game.playerRotationPosition === index;

      players[player.playerId].answerCards = distributeCards(
        game.answerCards || [],
        5
      );

      // The current asker shouldn't be able to play a card, so they need to know that they are the asker
      players[player.playerId].socket.emit("start-game", {
        answerCards: players[player.playerId].answerCards,
        questionCard: game.questionCard[0],
        isAskingQuestion: player.isAskingQuestion
      });
    });
  });

  socket.on("submit-card", (result) => {
    const submittedCard = result.submittedCard;
    const playerId = result.playerId;
    const gameId = result.gameId;
    const game = games[gameId];

    // Adding submittedCard to game's submitted cards
    game.submittedCards.push({ player: playerId, card: submittedCard });

    // Remove card from answerCards array
    players[playerId].answerCards = players[playerId].answerCards.filter(
      (card) => card !== submittedCard
    );

    game.players.forEach((player) => {
      // If the person is asking the question, they should get the other cards
      if (player.isAskingQuestion) {
        players[player.playerId].socket.emit("receive-answer-card", {
          submittedCards: game.submittedCards
        });

        // If all cards are submitted, start reviewing
      }

      if (game.submittedCards.length === game.players.length - 1) {
        // If the person is asking the question, they should get the other cards
        players[player.playerId].socket.emit("start-card-review");
      }
    });
  });

  socket.on("show-current-answer", (result) => {
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
    const winningPlayerId = result.winningPlayerId;
    const gameId = result.gameId;
    const game = games[gameId];

    players[winningPlayerId].wonCards++;

    game.players.forEach((player) => {
      if (players[player.playerId].wonCards === 5) {
        game.players.forEach((player) => {
          players[player.playerId].socket.emit("show-game-winner", {
            winningPlayerId: playerId
          });
        });
      } else {
        players[player.playerId].socket.emit("show-round-winner", {
          winningPlayerId: playerId,
          wonCards: players[player.playerId].wonCards
        });
      }
    });
  });

  socket.on("new-round", (result) => {
    const gameId = result.gameId;
    const game = games[gameId];
    game.playerRotationPosition++;
    game.submittedCards = [];

    // Everyone gets to see the question card
    game.questionCard = distributeCards(game.questionCards || [], 1);
    if (game.playerRotationPosition === game.players.length - 1) {
      game.playerRotationPosition = 0;
    }
    game.players.forEach((player, index) => {
      game.players[index].isAskingQuestion =
        game.playerRotationPosition === index;

      const newCards = distributeCards(
        game.answerCards || [],
        5 - players[player.playerId].answerCards.length
      );
      players[player.playerId].answerCards =
        players[player.playerId].answerCards.concat(newCards);

      players[player.playerId].socket.emit("new-round", {
        answerCards: players[player.playerId].answerCards,
        questionCard: game.questionCard[0],
        isAskingQuestion: player.isAskingQuestion
      });
    });
  });

  // ... Rest of your socket.io logic ...
});

server.listen(8080, () => {
  console.log("listening on *:8080");
});

const guid = () => {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var str = "";
  for (var i = 0; i < 5; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
};

function distributeCards(array: string[], numberOfCards: number): string[] {
  if (array.length < numberOfCards) {
    return array;
  }

  let newArray: string[] = [];
  for (let i = 0; i < numberOfCards; i++) {
    const index = Math.floor(Math.random() * array.length);
    const element = array.splice(index, 1)[0];
    newArray.push(element);
  }

  return newArray;
}
