import { describe, test, beforeEach, afterEach } from "mocha";
import assert from "node:assert";
import sinon from "sinon";
import { VsCodeIde } from '../../VsCodeIde';

// Mock the vscode module
const mockVscode = {
  Uri: {
    file: (path: string) => ({ fsPath: path })
  },
  workspace: {
    fs: {
      readDirectory: sinon.stub().resolves([])
    }
  }
};

// Replace the real vscode module with our mock
import * as vscode from 'vscode';
(global as any).vscode = mockVscode;

describe('VsCodeIde', () => {
  let ide: VsCodeIde;
  let mockIdeUtils: any;

  beforeEach(() => {
    mockIdeUtils = {
      getOpenFiles: sinon.stub().resolves([])
    };

    ide = new VsCodeIde(null as any, Promise.resolve(null as any));
    (ide as any).ideUtils = mockIdeUtils;
    (ide as any).subprocess = sinon.stub().resolves(['', '']);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getOpenFiles', () => {
    test('should return open files without conversion when not in WSL', async () => {
      sinon.stub(ide as any, 'isWsl').returns(false);
      const mockFiles = ['/path/to/file1', '/path/to/file2'];
      mockIdeUtils.getOpenFiles.resolves(mockFiles);

      const result = await ide.getOpenFiles();

      assert.deepStrictEqual(result, mockFiles);
    });

    test('should convert WSL paths when in WSL environment', async () => {
      sinon.stub(ide as any, 'isWsl').returns(true);

      const mockFiles = ['/mnt/c/path/to/file1', '/path/to/file2'];
      mockIdeUtils.getOpenFiles.resolves(mockFiles);

      (ide as any).subprocess.withArgs('wslpath -w "/mnt/c/path/to/file1"').resolves(['C:\\path\\to\\file1', '']);

      const result = await ide.getOpenFiles();

      assert.deepStrictEqual(result, ['C:\\path\\to\\file1', '/path/to/file2']);
    });

    test('should handle errors in WSL path conversion', async () => {
      sinon.stub(ide as any, 'isWsl').returns(true);

      const mockFiles = ['/mnt/c/path/to/file1', '/path/to/file2'];
      mockIdeUtils.getOpenFiles.resolves(mockFiles);

      (ide as any).subprocess.throws(new Error('Command failed'));


      const result = await ide.getOpenFiles();

      assert.deepStrictEqual(result, mockFiles);
    });
  });
});
