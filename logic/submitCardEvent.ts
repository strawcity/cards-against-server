import { Game, SubmitCardResult } from "../types";

export function submitCardEvent(game: Game, result: SubmitCardResult) {
  // Adding submittedCard to game's submitted cards
  game.submittedCards.push({
    player: result.playerId,
    card: result.submittedCard[0]
  });

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
    }

    // If all cards are submitted, start reviewing
    if (game.submittedCards.length === game.players.length - 1) {
      // If the person is asking the question, they should get the other cards
      player.socket.emit("start-card-review");
    }
  });
}
