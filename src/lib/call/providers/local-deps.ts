/**
 * Local system dependency preflight checks for call runtime.
 */

import { spawnSync } from 'node:child_process';

export interface LocalDependencyPreflightResult {
  ok: boolean;
  provider: 'local';
  dependency: 'ffmpeg' | 'ngrok';
  message: string;
}

function checkCommand(command: string, args: string[]): { ok: boolean; reason?: string } {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
    timeout: 4000,
  });

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return { ok: false, reason: 'not_found' };
    }
    return { ok: false, reason: error.message };
  }

  if (typeof result.status === 'number' && result.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: typeof result.status === 'number' ? `exit_${result.status}` : 'unknown_failure',
  };
}

// Tiny known-good MP3 sample used to verify ffmpeg can decode MP3 on this host.
// Generated from a short sine wave and embedded to avoid external files/tools.
const MP3_DECODE_SMOKE_SAMPLE_BASE64 =
  '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';

function checkFfmpegMp3Decode(): { ok: boolean; reason?: string } {
  const sample = Buffer.from(MP3_DECODE_SMOKE_SAMPLE_BASE64, 'base64');
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'mp3', '-i', 'pipe:0', '-f', 'null', '-'],
    {
      input: sample,
      stdio: ['pipe', 'ignore', 'pipe'],
      timeout: 6000,
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    return { ok: false, reason: error.message };
  }

  if (typeof result.status === 'number' && result.status === 0) {
    return { ok: true };
  }

  const stderr = result.stderr?.toString().trim();
  return {
    ok: false,
    reason: stderr ? stderr.slice(0, 220) : `exit_${result.status ?? 'unknown'}`,
  };
}

/**
 * Checks that ffmpeg is available for realtime MP3 -> µ-law conversion.
 */
export async function preflightFfmpeg(): Promise<LocalDependencyPreflightResult> {
  const check = checkCommand('ffmpeg', ['-version']);
  if (check.ok) {
    const decodeCheck = checkFfmpegMp3Decode();
    if (!decodeCheck.ok) {
      return {
        ok: false,
        provider: 'local',
        dependency: 'ffmpeg',
        message: `Local preflight failed: ffmpeg is installed but cannot decode MP3 (${decodeCheck.reason ?? 'unknown reason'}). Install a full ffmpeg build with MP3 decode support and retry.`,
      };
    }

    return {
      ok: true,
      provider: 'local',
      dependency: 'ffmpeg',
      message: 'Local preflight passed: ffmpeg is available and MP3 decode works.',
    };
  }

  if (check.reason === 'not_found') {
    return {
      ok: false,
      provider: 'local',
      dependency: 'ffmpeg',
      message: 'Local preflight failed: ffmpeg is not installed or not in PATH. Install ffmpeg and retry.',
    };
  }

  return {
    ok: false,
    provider: 'local',
    dependency: 'ffmpeg',
    message: `Local preflight failed: ffmpeg check could not run (${check.reason ?? 'unknown error'}).`,
  };
}

/**
 * Checks that ngrok is available (used by auto-infra call mode).
 */
export async function preflightNgrok(): Promise<LocalDependencyPreflightResult> {
  const check = checkCommand('ngrok', ['version']);
  if (check.ok) {
    return {
      ok: true,
      provider: 'local',
      dependency: 'ngrok',
      message: 'Local preflight passed: ngrok is available.',
    };
  }

  if (check.reason === 'not_found') {
    return {
      ok: false,
      provider: 'local',
      dependency: 'ngrok',
      message: 'Local preflight failed: ngrok is not installed or not in PATH. Install ngrok and retry.',
    };
  }

  return {
    ok: false,
    provider: 'local',
    dependency: 'ngrok',
    message: `Local preflight failed: ngrok check could not run (${check.reason ?? 'unknown error'}).`,
  };
}
