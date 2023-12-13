import { Game, ShowCurrentCardResult } from "../types";

export function showCurrentAnswer(result: ShowCurrentCardResult, game: Game) {
  game.players.forEach((player) => {
    player.socket.emit("show-answer", {
      inFocusCard: { player: result.playerId, answer: result.answer }
    });
  });
}
