import * as fs from 'fs/promises';

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    console.log(`${filePath} exists`);
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File does not exist
      console.log(`${filePath} does not exist`);
      return false;
    } else {
      // Some other error occurred
      console.error('Error checking file existence:', error);
      throw error;
    }
  }
}