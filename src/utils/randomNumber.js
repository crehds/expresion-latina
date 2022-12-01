/**
 * Generate one random number
 * @param {number} maxNumber limit for random numbers
 * @return random number
 */

function generateRandomNumber(maxNumber) {
  return Math.floor(Math.random() * maxNumber);
}

export default generateRandomNumber;
