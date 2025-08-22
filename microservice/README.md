# Continue Microservice

A unified microservice that consolidates all Continue AI Assistant functionality into a single, deployable service.

## Features

- **LLM Integration**: Support for multiple AI providers (OpenAI, Anthropic, Google, Ollama, etc.)
- **Code Autocomplete**: Intelligent code completion with context awareness
- **Chat Assistant**: Interactive coding assistant with slash commands
- **Code Editing**: AI-powered code editing and refactoring
- **Context Providers**: Access to codebase, files, git, terminal, and more
- **Indexing**: Codebase indexing with semantic search
- **Authentication**: JWT-based auth with API key and password support
- **IDE Integration**: REST APIs for editor integration

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# The service will be available at http://localhost:3000
```

### Docker Deployment

```bash
# Build and run with Docker
docker build -t continue-microservice .
docker run -p 3000:3000 continue-microservice

# Or use Docker Compose for full stack
docker-compose up -d
```

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Configuration
- `GET /config` - Get current configuration
- `POST /config` - Update configuration
- `GET /config/models` - Get available models

### LLM
- `POST /llm/chat` - Chat completion
- `POST /llm/complete` - Text completion
- `GET /llm/models` - List available models

### Context
- `POST /context/retrieve` - Retrieve context from providers
- `GET /context/providers` - List available context providers
- `POST /context/add-provider` - Add custom context provider

### Indexing
- `POST /index/codebase` - Index codebase
- `GET /index/status` - Get indexing status
- `POST /index/search` - Search indexed code

### Autocomplete
- `POST /autocomplete` - Get code completion
- `POST /autocomplete/accept` - Accept completion
- `POST /autocomplete/reject` - Reject completion

### Edit
- `POST /edit/apply` - Apply code edit
- `POST /edit/diff` - Generate diff
- `POST /edit/stream` - Stream edit process

### Chat
- `POST /chat/message` - Send chat message
- `GET /chat/history` - Get chat history
- `POST /chat/clear` - Clear chat history

### Authentication
- `POST /auth/login` - Login with credentials
- `POST /auth/logout` - Logout
- `GET /auth/user` - Get current user

### IDE Integration
- `POST /ide/workspace` - Workspace operations
- `POST /ide/files` - File operations
- `POST /ide/terminal` - Terminal operations

## Configuration

Create a `config.yaml` file:

```yaml
models:
  - title: "GPT-4"
    provider: "openai"
    model: "gpt-4"
    apiKey: "your-api-key"
    contextLength: 8192

  - title: "Claude 3.5 Sonnet"
    provider: "anthropic"
    model: "claude-3-5-sonnet-20241022"
    apiKey: "your-api-key"
    contextLength: 200000

selectedModel: "GPT-4"

contextProviders:
  - name: "codebase"
    params: {}
  - name: "diff"
    params: {}

slashCommands:
  - name: "edit"
    description: "Edit code using AI"
  - name: "commit"
    description: "Generate commit message"
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret
- `CONFIG_PATH` - Path to config file

## Slash Commands

The chat interface supports various slash commands:

- `/edit <instruction>` - Edit code with AI assistance
- `/comment` - Add comments to selected code
- `/share` - Share code snippets
- `/cmd <command>` - Run terminal commands
- `/commit` - Generate commit messages
- `/review` - Review code quality
- `/explain` - Explain code
- `/optimize` - Optimize code performance
- `/test` - Generate unit tests
- `/docs` - Generate documentation

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Start development server with auto-reload
npm run dev
```

## Deployment

### Docker

```bash
# Build image
docker build -t continue-microservice .

# Run container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e JWT_SECRET=your-secret \
  continue-microservice
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: continue-microservice
spec:
  replicas: 3
  selector:
    matchLabels:
      app: continue-microservice
  template:
    metadata:
      labels:
        app: continue-microservice
    spec:
      containers:
      - name: continue-microservice
        image: continue-microservice:latest
        ports:
        - containerPort: 3000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: continue-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /app/config.yaml
          subPath: config.yaml
      volumes:
      - name: config
        configMap:
          name: continue-config
---
apiVersion: v1
kind: Service
metadata:
  name: continue-microservice-service
spec:
  selector:
    app: continue-microservice
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Monitoring

### Health Checks

The service exposes health check endpoints:

- `GET /health` - Basic health status
- Health check includes service status, dependency checks, and basic metrics

### Metrics

When using Docker Compose, Prometheus and Grafana are included for monitoring:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

### Logging

The service uses structured logging with different levels:

- `ERROR` - Error conditions
- `WARN` - Warning conditions  
- `INFO` - Informational messages
- `DEBUG` - Debug messages (development only)

## Security

### Authentication

- JWT-based authentication
- Support for API keys and username/password
- Session management with configurable timeouts

### Authorization

- Permission-based access control
- Different permission levels for different operations
- Configurable user roles

### Security Headers

- Helmet.js for security headers
- CORS configuration
- Rate limiting (recommended for production)

## Performance

### Caching

- In-memory caching for completions and context
- Configurable cache sizes and TTL
- Redis support available via Docker Compose

### Optimization

- Request/response compression
- Connection pooling for external APIs
- Efficient context retrieval
- Streaming support for long operations

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   # Use different port
   PORT=3001 npm start
   ```

2. **Missing API keys**
   ```bash
   # Check config file
   cat config.yaml
   # Verify environment variables
   env | grep API
   ```

3. **Context retrieval errors**
   ```bash
   # Check file permissions
   ls -la /path/to/workspace
   # Verify git repository
   git status
   ```

### Logs

```bash
# Docker logs
docker logs continue-microservice

# Docker Compose logs
docker-compose logs -f continue-microservice

# Application logs in development
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

Apache 2.0 License - see LICENSE file for details.