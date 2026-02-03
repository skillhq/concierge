import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSpawnSync } = vi.hoisted(() => ({
  mockSpawnSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

import { preflightFfmpeg, preflightNgrok } from '../src/lib/call/providers/local-deps.js';

describe('local dependency preflight', () => {
  beforeEach(() => {
    mockSpawnSync.mockReset();
  });

  it('passes when ffmpeg is available', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0 }) // ffmpeg -version
      .mockReturnValueOnce({ status: 0, stderr: Buffer.from('') }); // decode smoke test

    const result = await preflightFfmpeg();

    expect(result.ok).toBe(true);
    expect(result.dependency).toBe('ffmpeg');
    expect(result.message).toContain('MP3 decode works');
    expect(mockSpawnSync).toHaveBeenCalledWith('ffmpeg', ['-version'], expect.objectContaining({ timeout: 4000 }));
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-f', 'mp3', '-i', 'pipe:0', '-f', 'null', '-'],
      expect.objectContaining({ timeout: 6000 }),
    );
  });

  it('fails when ffmpeg is missing', async () => {
    mockSpawnSync.mockReturnValue({
      status: null,
      error: Object.assign(new Error('spawnSync ffmpeg ENOENT'), { code: 'ENOENT' }),
    });

    const result = await preflightFfmpeg();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('ffmpeg is not installed');
  });

  it('fails when ffmpeg exists but MP3 decode fails', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0 }) // ffmpeg -version
      .mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('Invalid data found when processing input'),
      });

    const result = await preflightFfmpeg();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('cannot decode MP3');
  });

  it('passes when ngrok is available', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });

    const result = await preflightNgrok();

    expect(result.ok).toBe(true);
    expect(result.dependency).toBe('ngrok');
    expect(result.message).toContain('ngrok is available');
    expect(mockSpawnSync).toHaveBeenCalledWith('ngrok', ['version'], expect.objectContaining({ timeout: 4000 }));
  });

  it('fails when ngrok is missing', async () => {
    mockSpawnSync.mockReturnValue({
      status: null,
      error: Object.assign(new Error('spawnSync ngrok ENOENT'), { code: 'ENOENT' }),
    });

    const result = await preflightNgrok();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('ngrok is not installed');
  });
});
