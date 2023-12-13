import { Game } from "../types";

import { answers, questions } from "../cards/data";
import { distributeCards } from "./utils";
import { distributeAnswerCards } from "./gameLogic";

export function startGameRound(game: Game) {
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
