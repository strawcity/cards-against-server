const { answers, questions } = require("./cards/data.cjs");
const http = require("http");
const websocketServer = require("websocket").server;
const httpServer = http.createServer();
httpServer.listen(8080, () => console.log("Listening.. on 8080"));


const players = {};
const games = {};
const thirtyMinutes = 30 * 60 * 1000;

setInterval(function () {
  let currentTime = Date.now();
  for (let game in games) {
    if (currentTime - games[game].timestamp > 30000) {
      delete games[game];
    }
  }
  for (let player in players) {

    if (currentTime - players[player].timestamp > 30000) {
      delete players[player];
    }
  }
}, thirtyMinutes);

const wsServer = new websocketServer({
  httpServer: httpServer,
});

wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);
  connection.on("open", () => console.log("opened!"));
  connection.on("close", () => console.log("closed!"));

  connection.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);
    if (result.method === "create-game") {
      // Expects a playerId and a nickname, returns a game and a list of players
      const playerId = result.playerId;
      const player = players[playerId];

      // Save player nickname
      player.nickname = result.nickname;

      // get a gameId, create a game
      const gameId = guid();
      games[gameId] = {
        timestamp: Date.now(),
        id: gameId,
        players: [],
        submittedCards: [],
      };

      // Add player to game
      const game = games[gameId];

      game.players.push({
        playerId: player.playerId,
        nickname: player.nickname,
      });

      const payLoad = {
        method: "create-game",
        game: games[gameId],
        nickname: result.nickname,
      };

      const con = players[playerId].connection;
      con.send(JSON.stringify(payLoad));
    }

    if (result.method === "join-game") {
      // Expects a playerId and a nickname, returns a game and a list of players
      const playerId = result.playerId;
      const gameId = result.gameId;
      const player = players[playerId];
      const game = games[gameId];

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
      });

      const payLoad = {
        method: "join-game",
        game: games[gameId],
        nickname: result.nickname,
      };

      game.players.forEach((player) => {
        players[player.playerId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "start-game") {
      const gameId = result.gameId;
      const game = games[gameId];

      game.answerCards = answers;
      game.questionCards = questions;

      // The initial position is 0 for 'start-game'
      game.playerRotationPosition = 0;
      game.players[game.playerRotationPosition].isAskingQuestion;

      // Everyone gets to see the question card
      game.questionCard = distributeCards(game.questionCards, 1);

      game.players.forEach((player, index) => {
        game.players[index].isAskingQuestion =
          game.playerRotationPosition === index;

        players[player.playerId].answerCards = distributeCards(
          game.answerCards,
          5
        );

        // The current asker shouldn't be able to play a card, so they need to know that they are the asker
        const payLoad = {
          method: "start-game",
          answerCards: players[player.playerId].answerCards,
          questionCard: game.questionCard[0],
          isAskingQuestion: player.isAskingQuestion,
        };
        players[player.playerId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "submit-card") {
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
          const payLoad = {
            method: "receive-answer-card",
            submittedCards: game.submittedCards,
          };
          players[player.playerId].connection.send(JSON.stringify(payLoad));

          // If all cards are submitted, start reviewing
        }

        if (game.submittedCards.length === game.players.length - 1) {
          // If the person is asking the question, they should get the other cards
          const payLoad = {
            method: "start-card-review",
          };
          players[player.playerId].connection.send(JSON.stringify(payLoad));
        }
      });
    }

    if (result.method === "show-current-answer") {
      const playerId = result.playerId;
      const answer = result.answer;
      const gameId = result.gameId;
      const game = games[gameId];

      game.players.forEach((player) => {
        const payLoad = {
          method: "show-answer",
          inFocusCard: { player: playerId, answer: answer },
        };
        players[player.playerId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "select-winner") {
      const winningPlayer = result.winningPlayer;
      const gameId = result.gameId;
      const game = games[gameId];

      players[winningPlayer].wonCards++;

      game.players.forEach((player) => {
        const payLoad = {
          method: "show-winner",
          winningPlayer: playerId,
          wonCards: players[player.playerId].wonCards
        };

        players[player.playerId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "new-round") {
      const gameId = result.gameId;
      const game = games[gameId];
      game.playerRotationPosition++;
      game.submittedCards = []

      // Everyone gets to see the question card
      game.questionCard = distributeCards(game.questionCards, 1);
      if (game.playerRotationPosition === game.players.length - 1) {
        game.playerRotationPosition = 0
      }
      game.players.forEach((player, index) => {
        game.players[index].isAskingQuestion =
          game.playerRotationPosition === index;

        const newCards = distributeCards(
          game.answerCards,
          5 - players[player.playerId].answerCards.length
        );
        players[player.playerId].answerCards = players[player.playerId].answerCards.concat(newCards);
        const payLoad = {
          method: "new-round",
          answerCards: players[player.playerId].answerCards,
          questionCard: game.questionCard[0],
          isAskingQuestion: player.isAskingQuestion,
        };

        players[player.playerId].connection.send(JSON.stringify(payLoad));
      });
    }
  });

  //generate a new playerId
  const playerId = guid();
  players[playerId] = {
    timestamp: Date.now(),
    playerId: playerId,
    nickname: null,
    isAskingQuestion: false,
    wonCards: 0,
    answerCards: [],
    connection: connection,
  };

  // on 'connect', send the playerId
  const payLoad = {
    method: "connect",
    playerId: playerId,
  };
  //send back the player connect
  connection.send(JSON.stringify(payLoad));
});

// then to call it, plus stitch in '4' in the third group
const guid = () => {
  // Create an array of all the possible characters that can be in the string
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  // Initialize the string to be returned
  var str = "";

  // Generate 5 random characters from the array and add them to the string
  for (var i = 0; i < 5; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }

  // Return the final string
  return str;
};


function distributeCards(array, numberOfCards) {
  // Check if the array has at least the required number of elements
  if (array.length < numberOfCards) {
    return array;
  }

  // Create a new array to hold the randomly selected strings
  let newArray = [];

  // Select random strings from the array and add them to the new array
  for (let i = 0; i < numberOfCards; i++) {
    // Generate a random index between 0 and the length of the array
    const index = Math.floor(Math.random() * array.length);

    // Remove the element at the random index from the array using splice()
    const element = array.splice(index, 1)[0];

    // Add the element to the new array
    newArray.push(element);
  }

  // Return the new array
  return newArray;
}
