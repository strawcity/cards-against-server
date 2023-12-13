import { Game, SelectWinnerResult } from "../types";

export function selectWinner(result: SelectWinnerResult, game: Game) {
  const winningPlayerId = result.winningPlayerId;

  game.players.forEach((player) => {
    if (player.playerId === winningPlayerId) {
      player.wonCards++;
    }

    if (player.wonCards === 5) {
      game.players.forEach((player) => {
        player.socket.emit("show-game-winner", winningPlayerId);
      });
    } else {
      player.socket.emit("show-round-winner", {
        winningPlayerId: winningPlayerId,
        wonCards: player.wonCards
      });
    }
  });
}
