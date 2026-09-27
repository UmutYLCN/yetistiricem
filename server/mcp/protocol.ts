// A small Model Context Protocol server over Streamable HTTP, stateless: each
// POST carries one JSON-RPC message (or a batch) and gets one JSON answer. No
// sessions, no server-sent events, no requests from server to client: tools
// are all Yetişir offers, so this is enough for Claude, ChatGPT and
// Grok clients. Spec: https://modelcontextprotocol.io/specification
import type { WebHandler } from '../playlistEndpoint.ts';
import type { Account } from './account.ts';

/** Newest first; an unknown version asked for gets the newest. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;

/** Largest request body read (a camp JSON with thousands of videos fits). */
export const MAX_BODY_BYTES = 1_500_000;

export type JsonSchema = Record<string, unknown>;

export interface ToolResult {
  /** What the model reads. */
  text: string;
  /** The same answer as data, for clients that use it. */
  structured?: Record<string, unknown>;
  /** A problem the model can fix (bad input, a playlist that is private…). */
  isError?: boolean;
}

export interface ToolContext {
  request: Request;
  /** The signed-in student the client acts for. */
  account: Account;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface McpServerOptions {
  name: string;
  title: string;
  version: string;
  /** Guidance sent on initialize: what the server is for and its rules. */
  instructions: string;
  tools: Tool[];
  /**
   * Who is calling: the account, or the response to send instead (401 with
   * where to sign in). Runs before any message is read.
   */
  authenticate: (request: Request) => Promise<Account | Response>;
  /** Where failures are reported. Messages carry no user input. */
  log?: (message: string) => void;
}

type Id = string | number | null;
type JsonRpcResponse = { jsonrpc: '2.0'; id: Id } & ({ result: unknown } | { error: { code: number; message: string } });

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is Id => typeof value === 'string' || typeof value === 'number' || value === null;

function reply(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

/** CORS on responses built elsewhere (the 401 from `authenticate`). */
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
  return new Response(response.body, { status: response.status, headers });
}

const failure = (id: Id, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });
const success = (id: Id, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) return null;
  return new TextDecoder().decode(buffer);
}

export function createMcpServer(options: McpServerOptions): WebHandler {
  const log = options.log ?? (message => console.warn(message));
  const tools = new Map(options.tools.map(tool => [tool.name, tool]));
  const listed = options.tools.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
  }));

  async function callTool(id: Id, params: Record<string, unknown>, context: ToolContext): Promise<JsonRpcResponse> {
    const tool = typeof params.name === 'string' ? tools.get(params.name) : undefined;
    if (!tool) return failure(id, INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isRecord(args)) return failure(id, INVALID_PARAMS, 'Tool arguments must be an object.');
    let result: ToolResult;
    try {
      result = await tool.run(args, context);
    } catch (error) {
      log(`[mcp] ${tool.name} failed: ${error instanceof Error ? error.name : 'error'}`);
      result = { text: 'Something went wrong on the Yetişir server. Try again in a moment.', isError: true };
    }
    return success(id, {
      content: [{ type: 'text', text: result.text }],
      ...(result.structured ? { structuredContent: result.structured } : {}),
      isError: result.isError === true,
    });
  }

  /** One message: a response for a request, null for a notification or a client response. */
  async function handle(message: unknown, context: ToolContext): Promise<JsonRpcResponse | null> {
    if (!isRecord(message) || message.jsonrpc !== '2.0') return failure(null, INVALID_REQUEST, 'Not a JSON-RPC 2.0 message.');
    if (typeof message.method !== 'string') return null; // a response to nothing we sent
    if (!('id' in message)) return null; // notifications (initialized, cancelled…) need no answer
    const id = message.id;
    if (!isId(id)) return failure(null, INVALID_REQUEST, 'Invalid id.');
    const params = isRecord(message.params) ? message.params : {};

    switch (message.method) {
      case 'initialize': {
        const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
        const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : PROTOCOL_VERSIONS[0];
        return success(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: options.name, title: options.title, version: options.version },
          instructions: options.instructions,
        });
      }
      case 'ping':
        return success(id, {});
      case 'tools/list':
        return success(id, { tools: listed });
      case 'tools/call':
        return callTool(id, params, context);
      default:
        return failure(id, METHOD_NOT_FOUND, `Method not found: ${message.method}`);
    }
  }

  return async request => {
    if (request.method === 'OPTIONS') return reply(204);
    if (request.method !== 'POST') {
      // No server-sent event stream and no sessions to end.
      return reply(405, failure(null, INVALID_REQUEST, 'Use POST.'), { Allow: 'POST, OPTIONS' });
    }
    const version = request.headers.get('mcp-protocol-version');
    if (version && !(PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
      return reply(400, failure(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${version.slice(0, 40)}`));
    }
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return reply(415, failure(null, INVALID_REQUEST, 'Content-Type must be application/json.'));
    }

    const account = await options.authenticate(request);
    if (account instanceof Response) return withCors(account);

    const body = await readBody(request);
    if (body === null) return reply(413, failure(null, INVALID_REQUEST, 'Request too large.'));
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return reply(400, failure(null, PARSE_ERROR, 'Parse error.'));
    }

    const context = { request, account };
    try {
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return reply(400, failure(null, INVALID_REQUEST, 'Empty batch.'));
        const answers = (await Promise.all(parsed.map(message => handle(message, context)))).filter(a => a !== null);
        return answers.length > 0 ? reply(200, answers) : reply(202);
      }
      const answer = await handle(parsed, context);
      return answer ? reply(200, answer) : reply(202);
    } catch (error) {
      log(`[mcp] request failed: ${error instanceof Error ? error.name : 'error'}`);
      return reply(500, failure(null, INTERNAL_ERROR, 'Internal error.'));
    }
  };
}
