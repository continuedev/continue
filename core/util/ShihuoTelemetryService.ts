import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { IdeInfo } from "../index.js";
import { getShihuoUserInfo } from "./ShihuoUserInfo";

export interface ShihuoTelemetryConfig {
  enabled: boolean;
  reportInterval: number; // 上报间隔(ms)
  batchSize: number;
  retryAttempts: number;
  retryDelay: number; // 重试延迟(ms)
  requestTimeout: number; // 请求超时(ms)
}

// Removed ShihuoUserInfoProvider interface - now using simple utility function

export interface ShihuoTelemetryEvent {
  event: string;
  properties: { [key: string]: any };
  timestamp: string;
  distinctId: string;
  os?: string;
  extensionVersion?: string;
  ideName?: string;
  ideType?: string;
}

export class ShihuoTelemetryService {
  private static instance: ShihuoTelemetryService | undefined;
  private config: ShihuoTelemetryConfig;
  private eventQueue: ShihuoTelemetryEvent[] = [];
  private reportTimer: NodeJS.Timeout | null = null;
  private failedEvents: ShihuoTelemetryEvent[] = [];
  private deviceId: string | null = null;
  private ideInfo: IdeInfo | undefined;

  private constructor() {
    this.config = {
      enabled: true,
      reportInterval: 5 * 60 * 1000, // 5分钟
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      requestTimeout: 10000,
    };
    this.startPeriodicReporting();
  }

  public static getInstance(): ShihuoTelemetryService {
    if (!ShihuoTelemetryService.instance) {
      ShihuoTelemetryService.instance = new ShihuoTelemetryService();
    }
    return ShihuoTelemetryService.instance;
  }

  public static clearInstance() {
    ShihuoTelemetryService.instance = undefined;
  }

  /**
   * 初始化服务
   */
  public initialize(ideInfo: IdeInfo) {
    this.ideInfo = ideInfo;
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * 捕获事件并添加到队列
   */
  public capture(
    event: string,
    properties: { [key: string]: any },
    distinctId: string,
  ) {
    if (!this.config.enabled) {
      return;
    }

    const telemetryEvent: ShihuoTelemetryEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
      distinctId,
      os: os.platform(),
      extensionVersion: this.ideInfo?.extensionVersion,
      ideName: this.ideInfo?.name,
      ideType: this.ideInfo?.ideType,
    };

    this.eventQueue.push(telemetryEvent);

    // 如果队列达到批量大小，立即上报（但在测试环境中跳过实际上报）
    if (
      this.eventQueue.length >= this.config.batchSize &&
      process.env.NODE_ENV !== "test"
    ) {
      this.flushEventQueue();
    }
  }

  /**
   * 获取或创建设备ID
   */
  private getOrCreateDeviceId(): string {
    const deviceIdPath = this.getDeviceIdPath();

    try {
      // 尝试从文件读取现有的deviceId
      if (fs.existsSync(deviceIdPath)) {
        const deviceId = fs.readFileSync(deviceIdPath, "utf8").trim();
        if (deviceId) {
          return deviceId;
        }
      }

      // 如果不存在，生成新的deviceId
      const deviceId = this.generateDeviceId();

      // 确保目录存在
      const deviceIdDir = path.dirname(deviceIdPath);
      if (!fs.existsSync(deviceIdDir)) {
        fs.mkdirSync(deviceIdDir, { recursive: true });
      }

      // 保存到文件
      fs.writeFileSync(deviceIdPath, deviceId, "utf8");
      return deviceId;
    } catch (error) {
      console.warn("无法读写设备ID文件，使用临时ID:", error);
      return this.generateDeviceId();
    }
  }

  /**
   * 获取Continue数据目录路径
   */
  private getContinueDataPath(): string {
    try {
      const continueGlobalDir =
        process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), ".continue");
      const devDataPath = path.join(continueGlobalDir, "dev_data");
      const versionPath = path.join(devDataPath, "0.2.0");

      if (!fs.existsSync(versionPath)) {
        fs.mkdirSync(versionPath, { recursive: true });
      }

      return versionPath;
    } catch {
      // 回退到简单路径
      const fallbackPath = path.join(process.cwd(), ".continue");
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
      }
      return fallbackPath;
    }
  }

  /**
   * 获取设备ID文件的存储路径
   */
  private getDeviceIdPath(): string {
    return path.join(this.getContinueDataPath(), "shihuo-device-id.txt");
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    return crypto.randomUUID();
  }

  /**
   * 开始定期上报
   */
  private startPeriodicReporting() {
    if (!this.config.enabled) {
      return;
    }

    this.reportTimer = setInterval(() => {
      this.flushEventQueue();
    }, this.config.reportInterval);
  }

  /**
   * 清空事件队列并上报
   */
  private async flushEventQueue() {
    // 合并正常队列和失败重试队列
    const allEventsToReport = [...this.failedEvents, ...this.eventQueue];
    if (allEventsToReport.length === 0) {
      return;
    }

    // 清空队列
    this.eventQueue = [];
    this.failedEvents = [];

    // 在测试环境中跳过实际上报
    if (process.env.NODE_ENV === "test") {
      console.log(
        `Test mode: Would report ${allEventsToReport.length} telemetry events to Shihuo`,
      );
      return;
    }

    try {
      await this.sendReport(allEventsToReport);
      console.log(
        `Successfully reported ${allEventsToReport.length} telemetry events to Shihuo`,
      );
    } catch (error) {
      console.warn("Failed to report telemetry data to Shihuo:", error);
      // 将失败的事件加入失败队列
      this.failedEvents.push(...allEventsToReport);

      // 如果失败队列过大，丢弃最老的事件以避免内存泄漏
      const maxFailedEvents = this.config.batchSize * 2;
      if (this.failedEvents.length > maxFailedEvents) {
        const toDiscard = this.failedEvents.length - maxFailedEvents;
        this.failedEvents.splice(0, toDiscard);
        console.warn(
          `Discarded ${toDiscard} old failed events to prevent memory leak`,
        );
      }
    }
  }

  /**
   * 发送报告到Shihuo
   */
  private async sendReport(events: ShihuoTelemetryEvent[]) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.uploadToShihuo(events);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Shihuo telemetry report attempt ${attempt} failed:`,
          error,
        );

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`All ${this.config.retryAttempts} attempts failed`);
    throw lastError;
  }

  /**
   * 上传数据到Shihuo
   */
  private async uploadToShihuo(events: ShihuoTelemetryEvent[]) {
    try {
      // 获取用户信息
      const userInfo = await this.getUserInfoFromSession();
      const deviceId = this.deviceId || this.getOrCreateDeviceId();

      // 构建业务数据
      const bizData = {
        events,
        event_count: events.length,
        name: userInfo.name,
        dept_name: userInfo.dept_name,
        timestamp: new Date().toISOString(),
      };

      console.log("Shihuo telemetry bizData", bizData);

      const params: Record<string, any> = {
        pti: {
          id: "continue_telemetry", // 使用Continue telemetry的标识
          biz: JSON.stringify(bizData),
        },
        device_id: deviceId,
        client_code: userInfo.name,
        channel: "Continue", // 使用Continue作为渠道
        action_time: new Date().getTime(),
        APIVersion: "0.6.0",
      };

      const paramsStr =
        "?" +
        Object.entries(params)
          .map(([key, value]) => {
            const stringValue =
              typeof value === "object" ? JSON.stringify(value) : String(value);
            return `${key}=${encodeURIComponent(stringValue)}`;
          })
          .join("&");

      const response = await fetch(
        "https://sh-gateway.shihuo.cn/v4/services/sh-elance-api/track/auto_track",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: paramsStr }),
          signal: AbortSignal.timeout(this.config.requestTimeout),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Shihuo telemetry response error:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 检查响应是否有内容
      const responseText = await response.text();
      if (responseText.trim()) {
        try {
          JSON.parse(responseText);
        } catch (parseError) {
          // 即使不是JSON，如果状态码是200，我们也认为请求成功了
        }
      }
    } catch (error) {
      console.error("Shihuo telemetry upload error:", error);
      throw error;
    }
  }

  /**
   * 获取用户信息（简化版本）
   */
  private async getUserInfoFromSession(): Promise<{
    name: string;
    dept_name: string;
  }> {
    return await getShihuoUserInfo();
  }

  /**
   * 配置上报设置
   */
  public configureReporting(config: Partial<ShihuoTelemetryConfig>) {
    this.config = { ...this.config, ...config };

    // 重启定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    if (this.config.enabled) {
      this.startPeriodicReporting();
    }
  }

  /**
   * 强制立即上报
   */
  public async forceReport() {
    await this.flushEventQueue();
  }

  /**
   * 获取当前配置
   */
  public getConfig(): ShihuoTelemetryConfig {
    return { ...this.config };
  }

  /**
   * 获取队列状态用于调试
   */
  public getQueueStatus() {
    return {
      eventQueueLength: this.eventQueue.length,
      failedEventsLength: this.failedEvents.length,
      deviceId: this.deviceId,
    };
  }

  /**
   * 关闭服务
   */
  public shutdown() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    // 最后一次上报
    void this.flushEventQueue();
  }
}
