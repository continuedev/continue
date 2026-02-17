export class TokensBatchingService {
  private static instance: TokensBatchingService;

  static getInstance(): TokensBatchingService {
    if (!TokensBatchingService.instance) {
      TokensBatchingService.instance = new TokensBatchingService();
    }
    return TokensBatchingService.instance;
  }

  private constructor() {}

  addTokens(
    _model: string,
    _provider: string,
    _promptTokens: number,
    _generatedTokens: number,
  ): void {}

  shutdown(): void {}
}
