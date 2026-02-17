// Sentry has been removed - stubs kept for import compatibility

export function anonymizeFilePath(filePath: string): string {
  return filePath;
}

export function anonymizeStackTrace(frames: any[]): any[] {
  return frames;
}

export function anonymizeUserInfo(user: any): any {
  return user;
}

export function anonymizeSentryEvent(event: any): any | null {
  return event;
}
