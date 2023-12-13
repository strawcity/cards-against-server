export const guid = () => {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var str = "";
  for (var i = 0; i < 5; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
};

export function distributeCards(
  array: string[],
  numberOfCards: number
): string[] {
  if (array.length < numberOfCards) {
    return array;
  }

  let newArray: string[] = [];
  for (let i = 0; i < numberOfCards; i++) {
    const index = Math.floor(Math.random() * array.length);
    const element = array.splice(index, 1)[0];
    newArray.push(element);
  }

  return newArray;
}
