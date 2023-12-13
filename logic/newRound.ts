import { Game } from "../types";
import { distributeCards } from "./utils";

export function newRound(game: Game) {
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
      5 - player.answerCards.length
    );
    player.answerCards = player.answerCards.concat(newCards);

    player.socket.emit("new-round", {
      answerCards: player.answerCards,
      questionCard: game.questionCard[0],
      isAskingQuestion: player.isAskingQuestion
    });
  });
}
