import { Socket } from "socket.io";
import {
  Game,
  Player,
  GameState,
  JoinGameResult,
  CreateGameResult
} from "./../types"; // Import your types
import { distributeCards, guid } from "./utils";

export function initializePlayer(
  result: CreateGameResult | JoinGameResult,
  socket: Socket
): Player {
  return {
    timestamp: Date.now(),
    playerId: result.playerId,
    nickname: result.nickname,
    isAskingQuestion: false,
    wonCards: 0,
    answerCards: [],
    socket
  };
}

export function initializeGameState(gameId: string): Game {
  return {
    timestamp: Date.now(),
    id: gameId,
    players: [],
    submittedCards: [],
    playerRotationPosition: 0,
    questionCard: [],
    answerCards: [],
    questionCards: [],
    state: GameState.Lobby
  };
}

export function distributeAnswerCards(game: Game) {
  game.players.forEach((player) => {
    player.answerCards = distributeCards(game.answerCards || [], 5);
    player.socket.emit("start-game", {
      answerCards: player.answerCards,
      questionCard: game.questionCard[0],
      isAskingQuestion: player.isAskingQuestion
    });
  });
}

export function joinGame(game: Game, result: JoinGameResult, socket: Socket) {
  // Add player to game
  game.players.push(initializePlayer(result, socket));

  game.players.forEach((player) => {
    player.socket.emit("join-game", {
      game: game,
      nickname: result.nickname
    });
  });
}
