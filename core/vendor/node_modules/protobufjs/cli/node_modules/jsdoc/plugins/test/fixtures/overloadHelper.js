/**
 * A bowl of non-spicy soup.
 * @class
 *//**
 * A bowl of spicy soup.
 * @class
 * @param {number} spiciness - The spiciness of the soup, in Scoville heat units (SHU).
 */
function Soup(spiciness) {}

/**
 * Slurp the soup.
 *//**
 * Slurp the soup loudly.
 * @param {number} dBA - The slurping volume, in A-weighted decibels.
 */
Soup.prototype.slurp = function(dBA) {};

/**
 * Salt the soup as needed, using a highly optimized soup-salting heuristic.
 *//**
 * Salt the soup, specifying the amount of salt to add.
 * @variation mg
 * @param {number} amount - The amount of salt to add, in milligrams.
 */
Soup.prototype.salt = function(amount) {};

/**
 * Heat the soup by the specified number of degrees.
 * @param {number} degrees - The number of degrees, in Fahrenheit, by which to heat the soup.
 *//**
 * Heat the soup by the specified number of degrees.
 * @variation 1
 * @param {string} degrees - The number of degrees, in Fahrenheit, by which to heat the soup, but
 * as a string for some reason.
 *//**
 * Heat the soup by the specified number of degrees.
 * @param {boolean} degrees - The number of degrees, as a boolean. Wait, what?
 */
Soup.prototype.heat = function(degrees) {};

/**
 * Discard the soup.
 * @variation discardSoup
 *//**
 * Discard the soup by pouring it into the specified container.
 * @variation discardSoup
 * @param {Object} container - The container in which to discard the soup.
 */
Soup.prototype.discard = function(container) {};
