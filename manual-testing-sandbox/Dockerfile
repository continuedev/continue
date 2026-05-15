# Multi-stage Dockerfile for security and smaller image size
# Stage 1: Build stage - install dependencies
FROM python:3.12-slim AS builder

# Set working directory
WORKDIR /app

# Copy requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Production stage - minimal image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy installed dependencies from builder stage
COPY --from=builder /install /usr/local

# Copy the rest of the application code
COPY . .

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -m appuser && chown -R appuser:appuser /app

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Expose the port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Switch to non-root user
USER appuser

# Start the application
CMD ["python", "app.py"]
