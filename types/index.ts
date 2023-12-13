import { Socket } from "socket.io";

export interface Player {
  playerId: string;
  nickname: string;
  answerCards: string[];
  isAskingQuestion: boolean;
  wonCards: number;
  timestamp: number;
  socket: Socket; // Update this type based on your Socket.IO socket type
}

export enum GameState {
  Lobby = "Lobby",
  InProgress = "InProgress",
  CardReview = "CardReview",
  RoundEnd = "RoundEnd",
  GameEnd = "GameEnd"
}

export interface Game {
  timestamp: number;
  id: string;
  players: Player[];
  // players: { [playerId: string]: Player }[];
  submittedCards: { player: string; card: string }[];
  playerRotationPosition: number;
  questionCard: string[];
  answerCards: string[];
  questionCards?: string[];
  state: GameState;
}

export interface CreateGameResult {
  playerId: string;
  nickname: string;
}

export interface JoinGameResult {
  playerId: string;
  nickname: string;
  gameId: string;
}

export interface StartGameResult {
  gameId: string;
}

export interface SubmitCardResult {
  submittedCard: string[];
  playerId: string;
  gameId: string;
}

export interface ShowCurrentCardResult {
  playerId: string;
  gameId: string;
  answer: string[];
}

export interface SelectWinnerResult {
  winningPlayerId: string;
  gameId: string;
}
