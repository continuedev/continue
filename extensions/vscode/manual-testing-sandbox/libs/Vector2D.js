/**
 * Represents a 2D vector.
 */
class Vector2D {
    /**
     * Creates a new instance of Vector2D.
     * @param {number} x - The x-component of the vector.
     * @param {number} y - The y-component of the vector.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Calculates the dot product of this vector and another vector.
     * @param {Vector2D} other - The other vector.
     * @returns {number} The dot product.
     */
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Normalizes this vector.
     * @returns {Vector2D} The normalized vector.
     */
    normalize() {
        const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
        return new Vector2D(this.x / magnitude, this.y / magnitude);
    }

    /**
     * Adds another vector to this vector.
     * @param {Vector2D} other - The other vector.
     * @returns {Vector2D} The resulting vector.
     */
    add(other) {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    /**
     * Multiplies this vector by a scalar value.
     * @param {number} scalar - The scalar value.
     * @returns {Vector2D} The resulting vector.
     */
    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    print() {
        console.log(`${x} ${y}`);
    }
}

export default Vector2D