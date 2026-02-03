/**
 * Call server - HTTP + WebSocket server for voice calls
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { CallSession } from './call-session.js';
import type {
  CallConfig,
  CallState,
  ClientMessage,
  ServerMessage,
} from './call-types.js';
import {
  formatPhoneNumber,
  generateErrorTwiml,
  generateMediaStreamsTwiml,
  initiateCall,
  parseWebhookBody,
  preflightTwilioCallSetup,
  validateWebhookSignature,
} from './providers/twilio.js';
import { preflightDeepgramSTT } from './providers/deepgram.js';
import { preflightElevenLabsTTSBudget } from './providers/elevenlabs.js';

// Maximum request body size (1MB)
const MAX_BODY_SIZE = 1024 * 1024;
// Maximum lengths for call request fields
const MAX_PHONE_LENGTH = 20;
const MAX_GOAL_LENGTH = 1000;
const MAX_CONTEXT_LENGTH = 5000;

export interface CallServerOptions {
  port: number;
  publicUrl: string;
  config: CallConfig;
}

export interface CallServerEvents {
  started: () => void;
  stopped: () => void;
  call_started: (callId: string) => void;
  call_ended: (callId: string, state: CallState) => void;
  error: (error: Error) => void;
}

export class CallServer extends EventEmitter {
  private server: Server | null = null;
  private controlWss: WebSocketServer | null = null;
  private mediaWss: WebSocketServer | null = null;
  private readonly options: CallServerOptions;
  private readonly sessions: Map<string, CallSession> = new Map();
  private readonly controlClients: Set<WebSocket> = new Set();

  constructor(options: CallServerOptions) {
    super();
    this.options = options;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private log(message: string): void {
    console.log(`[${this.timestamp()}] ${message}`);
  }

  private warn(message: string): void {
    console.warn(`[${this.timestamp()}] ${message}`);
  }

  private error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(`[${this.timestamp()}] ${message}`, error);
    } else {
      console.error(`[${this.timestamp()}] ${message}`);
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer((req, res) => this.handleHttpRequest(req, res));

        // Create WebSocket servers
        this.controlWss = new WebSocketServer({ noServer: true });
        this.mediaWss = new WebSocketServer({ noServer: true });

        // Handle WebSocket upgrades
        this.server.on('upgrade', (request, socket, head) => {
          const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
          const pathname = url.pathname;
          this.log(`[Server] WebSocket upgrade request: ${pathname}`);

          if (pathname === '/control') {
            this.log('[Server] Handling /control WebSocket upgrade');
            this.controlWss?.handleUpgrade(request, socket, head, (ws) => {
              this.handleControlConnection(ws);
            });
          } else if (pathname.startsWith('/media-stream')) {
            // Twilio doesn't pass query params in WebSocket URL - callId comes in 'start' event
            this.log('[Server] Handling /media-stream WebSocket upgrade');
            this.mediaWss?.handleUpgrade(request, socket, head, (ws) => {
              this.handleMediaStreamConnection(ws);
            });
          } else {
            this.log(`[Server] Unknown WebSocket path: ${pathname}, destroying socket`);
            socket.destroy();
          }
        });

        this.server.listen(this.options.port, () => {
          this.log(`Call server listening on port ${this.options.port}`);
          this.log(`Public URL: ${this.options.publicUrl}`);
          this.emit('started');
          resolve();
        });

        this.server.on('error', (err) => {
          this.emit('error', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // End all active calls
    for (const session of this.sessions.values()) {
      await session.hangup();
    }
    this.sessions.clear();

    // Close control clients
    for (const client of this.controlClients) {
      client.close();
    }
    this.controlClients.clear();

    // Close WebSocket servers
    this.controlWss?.close();
    this.mediaWss?.close();

    // Close HTTP server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.emit('stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const method = req.method ?? 'GET';

    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route requests
    if (method === 'GET' && url.pathname === '/health') {
      this.handleHealthCheck(res);
    } else if (method === 'GET' && url.pathname === '/status') {
      this.handleStatusCheck(res);
    } else if (method === 'POST' && url.pathname === '/call') {
      this.handleCallRequest(req, res);
    } else if (method === 'POST' && url.pathname === '/twilio/voice') {
      this.handleTwilioVoice(req, res, url);
    } else if (method === 'POST' && url.pathname === '/twilio/status') {
      this.handleTwilioStatus(req, res, url);
    } else if (method === 'GET' && url.pathname.startsWith('/status/')) {
      this.handleCallStatusCheck(res, url.pathname.split('/').pop() ?? '');
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }

  /**
   * Server status endpoint
   */
  private handleStatusCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'running',
        activeCalls: this.sessions.size,
        controlClients: this.controlClients.size,
        publicUrl: this.options.publicUrl,
      }),
    );
  }

  /**
   * Call status endpoint
   */
  private handleCallStatusCheck(res: ServerResponse, callId: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session.getState()));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Call not found' }));
    }
  }

  /**
   * Initiate a new call via HTTP
   */
  private async handleCallRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = '';
    let bodySize = 0;

    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body) as { phoneNumber: string; goal: string; context?: string };

        // Input validation
        if (!data.phoneNumber || typeof data.phoneNumber !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'phoneNumber is required' }));
          return;
        }
        if (!data.goal || typeof data.goal !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'goal is required' }));
          return;
        }
        if (data.phoneNumber.length > MAX_PHONE_LENGTH) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'phoneNumber too long' }));
          return;
        }
        if (data.goal.length > MAX_GOAL_LENGTH) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'goal too long' }));
          return;
        }
        if (data.context && data.context.length > MAX_CONTEXT_LENGTH) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'context too long' }));
          return;
        }

        const callId = await this.initiateCallInternal(data.phoneNumber, data.goal, data.context);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ callId, status: 'initiating' }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        const statusCode = message.toLowerCase().includes('preflight') ? 400 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });
  }

  /**
   * Twilio voice webhook - returns TwiML for Media Streams
   */
  private handleTwilioVoice(req: IncomingMessage, res: ServerResponse, url: URL): void {
    let body = '';
    let bodySize = 0;

    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      // Validate Twilio webhook signature
      const signature = req.headers['x-twilio-signature'] as string | undefined;
      const webhookUrl = `${this.options.publicUrl}${req.url}`;
      const params = parseWebhookBody(body);

      if (signature && !validateWebhookSignature(this.options.config, signature, webhookUrl, params as unknown as Record<string, string>)) {
        this.warn('[Twilio] Invalid webhook signature');
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      const callId = url.searchParams.get('callId');

      if (!callId || !this.sessions.has(callId)) {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(generateErrorTwiml('Sorry, this call cannot be connected. Please try again later.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(generateMediaStreamsTwiml(this.options.config, callId));
    });
  }

  /**
   * Twilio status callback
   */
  private handleTwilioStatus(req: IncomingMessage, res: ServerResponse, url: URL): void {
    let body = '';
    let bodySize = 0;

    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      // Validate Twilio webhook signature
      const signature = req.headers['x-twilio-signature'] as string | undefined;
      const webhookUrl = `${this.options.publicUrl}${req.url}`;
      const params = parseWebhookBody(body);

      if (signature && !validateWebhookSignature(this.options.config, signature, webhookUrl, params as unknown as Record<string, string>)) {
        this.warn('[Twilio] Invalid webhook signature');
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      const callId = url.searchParams.get('callId');
      const webhook = params;
      const session = callId ? this.sessions.get(callId) : null;

      if (session) {
        switch (webhook.CallStatus) {
          case 'ringing':
            session.updateStatus('ringing');
            this.broadcastToControl({ type: 'call_ringing', callId: session.callId });
            break;
          case 'in-progress':
            // Status is set when media stream connects
            break;
          case 'completed':
          case 'busy':
          case 'failed':
          case 'no-answer':
            session.updateStatus(webhook.CallStatus);
            break;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  }

  /**
   * Handle control WebSocket connection
   */
  private handleControlConnection(ws: WebSocket): void {
    this.log('[Control] Client connected');
    this.controlClients.add(ws);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        await this.handleControlMessage(ws, msg);
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Invalid message',
          } as ServerMessage),
        );
      }
    });

    ws.on('close', () => {
      this.log('[Control] Client disconnected');
      this.controlClients.delete(ws);
    });

    ws.on('error', (err) => {
      this.error('[Control] Error:', err);
      this.controlClients.delete(ws);
    });
  }

  /**
   * Handle control messages from clients
   */
  private async handleControlMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'initiate_call': {
        // initiateCallInternal broadcasts call_started to all control clients,
        // so we don't need to send it directly to avoid duplicate events
        await this.initiateCallInternal(msg.phoneNumber, msg.goal, msg.context);
        break;
      }

      case 'speak': {
        const session = this.sessions.get(msg.callId);
        if (session) {
          await session.speak(msg.text);
        } else {
          ws.send(
            JSON.stringify({
              type: 'error',
              callId: msg.callId,
              message: 'Call not found',
            } as ServerMessage),
          );
        }
        break;
      }

      case 'hangup': {
        const session = this.sessions.get(msg.callId);
        if (session) {
          await session.hangup();
        }
        break;
      }
    }
  }

  /**
   * Handle media stream WebSocket connection
   * Twilio sends callId in the 'start' event's customParameters, not in the URL
   */
  private handleMediaStreamConnection(ws: WebSocket): void {
    this.log('[Media] Stream WebSocket connected, waiting for start event...');
    this.log(`[Media] Active sessions: ${[...this.sessions.keys()].join(', ')}`);

    let sessionInitialized = false;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle the 'start' event to get callId from customParameters
        if (msg.event === 'start' && !sessionInitialized) {
          const callId = msg.start?.customParameters?.callId;
          this.log(`[Media] Received start event, callId: ${callId}`);

          if (!callId) {
            this.error('[Media] No callId in start event customParameters');
            ws.close(1008, 'Missing callId');
            return;
          }

          const session = this.sessions.get(callId);
          if (!session) {
            this.error(`[Media] No session found for call ${callId}`);
            ws.close(1008, 'Call not found');
            return;
          }

          sessionInitialized = true;
          this.log('[Media] Found session, initializing media stream...');
          session.initializeMediaStream(ws, msg).then(() => {
            this.log('[Media] Media stream initialized successfully');
          }).catch((err) => {
            this.error('[Media] Failed to initialize:', err);
            // Clean up session on initialization failure
            this.sessions.delete(callId);
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
            ws.close(1011, 'Failed to initialize');
          });
        }
      } catch (err) {
        this.error('[Media] Error parsing message:', err);
      }
    });

    ws.on('close', () => {
      this.log('[Media] WebSocket closed');
    });

    ws.on('error', (err) => {
      this.error('[Media] WebSocket error:', err);
    });
  }

  /**
   * Internal method to initiate a call
   */
  private async initiateCallInternal(phoneNumber: string, goal: string, context?: string): Promise<string> {
    const [twilioPreflight, deepgramPreflight, elevenLabsPreflight] = await Promise.all([
      preflightTwilioCallSetup(this.options.config),
      preflightDeepgramSTT(this.options.config.deepgramApiKey),
      preflightElevenLabsTTSBudget(this.options.config.elevenLabsApiKey, goal, context),
    ]);

    const failedPreflight = [twilioPreflight, deepgramPreflight, elevenLabsPreflight].find(
      (result) => !result.ok,
    );
    if (failedPreflight) {
      throw new Error(failedPreflight.message);
    }

    this.log(`[Preflight] ${twilioPreflight.message}`);
    this.log(`[Preflight] ${deepgramPreflight.message}`);
    this.log(`[Preflight] ${elevenLabsPreflight.message}`);

    const callId = randomUUID();
    const formattedNumber = formatPhoneNumber(phoneNumber);

    // Create session
    const session = new CallSession(callId, this.options.config, formattedNumber, goal, context);

    // Forward session events to control clients
    session.on('message', (msg: ServerMessage) => {
      this.broadcastToControl(msg);
    });

    session.on('ended', (state: CallState) => {
      this.sessions.delete(callId);
      this.emit('call_ended', callId, state);
    });

    this.sessions.set(callId, session);

    // Initiate call via Twilio
    try {
      const result = await initiateCall(this.options.config, formattedNumber, callId);
      session.setCallSid(result.callSid);

      this.emit('call_started', callId);
      this.broadcastToControl({
        type: 'call_started',
        callId,
        callSid: result.callSid,
      });

      return callId;
    } catch (err) {
      this.sessions.delete(callId);
      throw err;
    }
  }

  /**
   * Broadcast message to all control clients
   */
  private broadcastToControl(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.controlClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Get a session by call ID
   */
  getSession(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Map<string, CallSession> {
    return new Map(this.sessions);
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this.server !== null;
  }
}

/**
 * Create and configure a call server
 */
export function createCallServer(config: CallConfig, port: number, publicUrl: string): CallServer {
  return new CallServer({
    port,
    publicUrl,
    config,
  });
}
