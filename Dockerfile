FROM ollama/ollama:latest

# --------------------------------------------------
# Runtime configuration (matches docker-compose)
# --------------------------------------------------
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_NO_UPDATE=1
ENV OLLAMA_DEBUG=false
ENV OLLAMA_MODELS=/root/.ollama/models
ENV OLLAMA_FORCE_MMAP=1

# --------------------------------------------------
# Preload models at build time (network allowed here)
# --------------------------------------------------
RUN ollama serve & \
    sleep 5 && \
    ollama pull llama3:8b && \
    ollama pull codellama:7b && \
    pkill ollama

# --------------------------------------------------
# Runtime
# --------------------------------------------------
EXPOSE 11434
ENTRYPOINT ["ollama"]
CMD ["serve"]