import { Socket } from "socket.io";
import {
  Game,
  Player,
  GameState,
  JoinGameResult,
  CreateGameResult
} from "./../types"; // Import your types
import { distributeCards, guid } from "./utils";
import { answers, questions } from "../cards/data";

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
export function initializeGameRound(game: Game) {
  game.answerCards = answers;
  game.questionCards = questions;

  // The initial position is 0 for 'start-game'
  game.playerRotationPosition = 0;
  game.players[game.playerRotationPosition].isAskingQuestion = true;

  // Everyone gets to see the question card
  game.questionCard = distributeCards(game.questionCards, 1);

  distributeAnswerCards(game);
  // Distribute answer cards to players
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

export function submitCardEvent(
  game: Game,
  playerId: string,
  submittedCard: string[]
) {
  // Adding submittedCard to game's submitted cards
  game.submittedCards.push({ player: playerId, card: submittedCard[0] });

  // Remove card from answerCards array
  // game.players[playerId].answerCards = game.players[
  //   playerId
  // ].answerCards.filter((card) => card !== submittedCard[0]);

  game.players.forEach((player) => {
    // If the person is asking the question, they should get the other cards
    if (player.isAskingQuestion) {
      player.socket.emit("receive-answer-card", {
        submittedCards: game.submittedCards
      });

      // If all cards are submitted, start reviewing
    }

    if (game.submittedCards.length === game.players.length - 1) {
      // If the person is asking the question, they should get the other cards
      player.socket.emit("start-card-review");
    }
  });
}
