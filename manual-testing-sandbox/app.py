"""Simple Flask application for Docker deployment."""

import os
from flask import Flask, jsonify

app = Flask(__name__)

PORT = int(os.environ.get("PORT", 8080))


@app.route("/")
def index():
    """Root endpoint."""
    return jsonify({"message": "Hello from the application!", "status": "healthy"})


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, threaded=True)
