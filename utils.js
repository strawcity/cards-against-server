export const guid = () => {
  // then to call it, plus stitch in '4' in the third group
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

/**
 * @param {string[]} array
 * @param {number} numberOfCards
 */
export const distributeCards = (array, numberOfCards) => {
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
};
