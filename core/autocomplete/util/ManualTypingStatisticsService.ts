import { Telemetry } from "../../util/posthog";

export interface ManualTypingStatistics {
  totalCharactersTyped: number;
  totalLinesTyped: number;
  totalKeystrokes: number;
  lastTypingTime: number;
}

export interface ManualTypingConfig {
  enabled: boolean;
  reportEnabled: boolean;
  reportInterval: number; // 上报间隔(ms)
}

export const DEFAULT_CONFIG: ManualTypingConfig = {
  enabled: true,
  reportEnabled: true,
  reportInterval: 5 * 60 * 1000, // 5分钟
};

export class ManualTypingStatisticsService {
  private static instance: ManualTypingStatisticsService | undefined;

  private statistics: ManualTypingStatistics = {
    totalCharactersTyped: 0,
    totalLinesTyped: 0,
    totalKeystrokes: 0,
    lastTypingTime: 0,
  };

  // 配置管理
  private config: ManualTypingConfig = DEFAULT_CONFIG;

  private reportTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startPeriodicReporting();
  }

  public static getInstance(): ManualTypingStatisticsService {
    if (!ManualTypingStatisticsService.instance) {
      ManualTypingStatisticsService.instance =
        new ManualTypingStatisticsService();
    }
    return ManualTypingStatisticsService.instance;
  }

  /**
   * 追踪用户手敲的字符
   */
  public trackManualTyping(charactersAdded: number, linesAdded: number): void {
    // 输入验证
    if (!this.validateInput(charactersAdded, linesAdded)) {
      return;
    }

    const now = Date.now();

    // 更新统计信息
    this.updateStatistics(charactersAdded, linesAdded, now);
  }

  /**
   * 获取当前统计信息
   */
  public getStatistics(): ManualTypingStatistics {
    return { ...this.statistics };
  }

  /**
   * 重置统计信息
   */
  public resetStatistics(): void {
    this.statistics = {
      totalCharactersTyped: 0,
      totalLinesTyped: 0,
      totalKeystrokes: 0,
      lastTypingTime: 0,
    };
  }

  /**
   * 上报成功后重置统计数据
   */
  private resetStatisticsAfterReport(): void {
    this.statistics.totalCharactersTyped = 0;
    this.statistics.totalLinesTyped = 0;
    this.statistics.totalKeystrokes = 0;
    // 保留 lastTypingTime 不变，用于判断输入间隔
  }

  /**
   * 开始定期上报
   */
  private startPeriodicReporting(): void {
    if (this.config.reportEnabled) {
      this.reportTimer = setInterval(() => {
        this.reportStatistics();
      }, this.config.reportInterval);
    }
  }

  /**
   * 上报统计信息
   */
  private async reportStatistics(): Promise<void> {
    // 如果没有统计数据，跳过上报
    if (
      this.statistics.totalCharactersTyped === 0 &&
      this.statistics.totalLinesTyped === 0 &&
      this.statistics.totalKeystrokes === 0
    ) {
      return;
    }

    try {
      // 使用Continue的telemetry系统上报统计信息
      await Telemetry.capture(
        "manual_typing_statistics",
        {
          totalCharactersTyped: this.statistics.totalCharactersTyped,
          totalLinesTyped: this.statistics.totalLinesTyped,
          totalKeystrokes: this.statistics.totalKeystrokes,
          lastTypingTime: this.statistics.lastTypingTime,
          reportTimestamp: new Date().toISOString(),
        },
        false, // 不发送给团队
      );

      console.log(
        `Successfully reported manual typing statistics: ${this.statistics.totalCharactersTyped} chars, ${this.statistics.totalLinesTyped} lines, ${this.statistics.totalKeystrokes} keystrokes`,
      );

      // 上报成功后重置统计数据
      this.resetStatisticsAfterReport();
    } catch (error) {
      console.warn("Failed to report manual typing statistics:", error);
    }
  }

  /**
   * Configure settings
   */
  public configure(config: Partial<ManualTypingConfig>) {
    this.config = { ...this.config, ...config };

    // 重启定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    if (this.config.reportEnabled) {
      this.startPeriodicReporting();
    }
  }

  /**
   * Force immediate report
   */
  public async forceReport() {
    await this.reportStatistics();
  }

  /**
   * Get current configuration
   */
  public getConfig(): ManualTypingConfig {
    return { ...this.config };
  }

  /**
   * 检查是否启用追踪
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 销毁服务
   */
  public dispose(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * 输入验证
   */
  private validateInput(charactersAdded: number, linesAdded: number): boolean {
    // 基本参数验证
    if (charactersAdded < 0 || linesAdded < 0) {
      console.warn("Invalid characters/lines count:", {
        charactersAdded,
        linesAdded,
      });
      return false;
    }

    if (charactersAdded > 10000 || linesAdded > 1000) {
      console.warn("Suspiciously large input detected:", {
        charactersAdded,
        linesAdded,
      });
      return false;
    }

    return true;
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(
    charactersAdded: number,
    linesAdded: number,
    timestamp: number,
  ): void {
    // 更新基础统计
    this.statistics.totalCharactersTyped += charactersAdded;
    this.statistics.totalLinesTyped += linesAdded;
    this.statistics.totalKeystrokes += 1;
    this.statistics.lastTypingTime = timestamp;
  }
}
