FROM node:20.20.1-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Default: run CI script (repo mounted at /workspace)
CMD ["bash", "scripts/ci-local.sh"]
