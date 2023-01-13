

const config = require('./config.js');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server,
  {
    cors: {
      origin: config.CORS_ALLOW
    }


  });
console.log("🚀 ~ config.CORS_ALLOW", config.CORS_ALLOW)
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

io.on('connection', (socket) => {
  //generate a new playerId
  const playerId = guid();

  players[playerId] = {
    timestamp: Date.now(),
    playerId: playerId,
    nickname: '',
    isAskingQuestion: false,
    wonCards: 0,
    answerCards: [],
    socket: socket
  };

  //Send the playerId to just this player
  socket.emit('connected', playerId);

  socket.on('create-game', (result) => {
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
      playerRotationPosition: 0,
      questionCard: []
    };
    // Add player to game
    const game = games[gameId];

    game.players.push({
      playerId: player.playerId,
      nickname: player.nickname
    });

    //io.emit sends it to everyone, so check for the right gameID before emitting to everyone
    io.emit('create-game', {
      game: games[gameId],
      nickname: result.nickname
    });
    socket.emit('create-game-socket', {
      game: games[gameId],
      nickname: result.nickname
    });
  });

  socket.on('join-game', (result) => {
    // Expects a playerId and a nickname, returns a game and a list of players
    const playerId = result.playerId;
    const gameId = result.gameId;
    const player = players[playerId];
    const game = games[gameId];

    if (game === undefined) {
      socket.emit('no-game', 'No game found');
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
      nickname: player.nickname
    });

    game.players.forEach((player) => {
      players[player.playerId].socket.emit('join-game', {
        game: games[gameId],
        nickname: result.nickname
      });
    });
  });

  socket.on('start-game', (result) => {
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
      game.players[index].isAskingQuestion = game.playerRotationPosition === index;

      players[player.playerId].answerCards = distributeCards(game.answerCards || [], 5);

      // The current asker shouldn't be able to play a card, so they need to know that they are the asker
      players[player.playerId].socket.emit('start-game', {
        answerCards: players[player.playerId].answerCards,
        questionCard: game.questionCard[0],
        isAskingQuestion: player.isAskingQuestion
      });
    });
  });

  socket.on('submit-card', (result) => {
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
        players[player.playerId].socket.emit('receive-answer-card', {
          submittedCards: game.submittedCards
        });

        // If all cards are submitted, start reviewing
      }

      if (game.submittedCards.length === game.players.length - 1) {
        // If the person is asking the question, they should get the other cards
        players[player.playerId].socket.emit('start-card-review');
      }
    });
  });

  socket.on('show-current-answer', (result) => {
    const playerId = result.playerId;
    const answer = result.answer;
    const gameId = result.gameId;
    const game = games[gameId];

    game.players.forEach((player) => {
      players[player.playerId].socket.emit('show-answer', {
        inFocusCard: { player: playerId, answer: answer }
      });
    });
  });

  socket.on('select-winner', (result) => {
    const winningPlayer = result.winningPlayer;
    const gameId = result.gameId;
    const game = games[gameId];

    players[winningPlayer].wonCards++;

    game.players.forEach((player) => {
      if (players[player.playerId].wonCards === 5) {
        game.players.forEach((player) => {
          players[player.playerId].socket.emit('show-game-winner', {
            winningPlayer: playerId
          });
        });
      } else {
        players[player.playerId].socket.emit('show-round-winner', {
          winningPlayer: playerId,
          wonCards: players[player.playerId].wonCards
        });
      }
    });
  });

  socket.on('new-round', (result) => {
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
      game.players[index].isAskingQuestion = game.playerRotationPosition === index;

      const newCards = distributeCards(
        game.answerCards || [],
        5 - players[player.playerId].answerCards.length
      );
      players[player.playerId].answerCards =
        players[player.playerId].answerCards.concat(newCards);

      players[player.playerId].socket.emit('new-round', {
        answerCards: players[player.playerId].answerCards,
        questionCard: game.questionCard[0],
        isAskingQuestion: player.isAskingQuestion
      });
    });
  });
});

server.listen(8080, () => {
  console.log('listening on *:8080');
});


// then to call it, plus stitch in '4' in the third group
const guid = () => {
  // Create an array of all the possible characters that can be in the string
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // Initialize the string to be returned
  var str = '';

  // Generate 5 random characters from the array and add them to the string
  for (var i = 0; i < 5; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }

  // Return the final string
  return str;
};

/**
 * @param {string[]} array
 * @param {number} numberOfCards
 */
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
