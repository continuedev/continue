FROM ollama/ollama:latest

# --------------------------------------------------
# Runtime configuration (matches docker-compose)
# --------------------------------------------------
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_NUM_CTX=2048
ENV OLLAMA_NUM_PARALLEL=1
ENV OLLAMA_MAX_LOADED_MODELS=1
ENV OLLAMA_FLASH_ATTENTION=0 
ENV OLLAMA_NO_UPDATE=1
ENV OLLAMA_DEBUG=false
ENV OLLAMA_MODELS=/root/.ollama/models

# --------------------------------------------------
# Preload models at build time (network allowed here)
# --------------------------------------------------
RUN ollama serve & \
    sleep 5 && \
    ollama pull qwen2.5-coder:1.5b && \
    pkill ollama

# --------------------------------------------------
# Runtime
# --------------------------------------------------
EXPOSE 11434
ENTRYPOINT ["ollama"]
CMD ["serve"]