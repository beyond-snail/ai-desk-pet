import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCHEMA_PATH = resolve('runtime/shared-ipc/schema-v1.json');

let cachedSchema = null;

function loadSchema() {
  if (!cachedSchema) {
    const raw = readFileSync(SCHEMA_PATH, 'utf8');
    cachedSchema = JSON.parse(raw);
  }
  return cachedSchema;
}

export function getSchema() {
  return loadSchema();
}

export function createMessage({
  event,
  source,
  target,
  payload = {},
  requestId = randomUUID(),
  timestamp = Date.now()
}) {
  const schema = loadSchema();
  if (!schema.events.includes(event)) {
    throw new Error(`unsupported event: ${event}`);
  }
  return {
    request_id: requestId,
    schema_version: schema.schema_version,
    timestamp,
    source,
    target,
    event,
    payload
  };
}

export function validateMessage(message) {
  const schema = loadSchema();
  const missing = [];
  for (const field of schema.required_fields) {
    if (!(field in message)) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return { ok: false, reason: `missing required fields: ${missing.join(',')}` };
  }
  if (message.schema_version !== schema.schema_version) {
    return {
      ok: false,
      reason: `schema_version mismatch: ${message.schema_version} != ${schema.schema_version}`
    };
  }
  if (!schema.events.includes(message.event)) {
    return { ok: false, reason: `unknown event: ${message.event}` };
  }
  return { ok: true };
}

export function encodeMessage(message) {
  return `${JSON.stringify(message)}\n`;
}

export function decodeLine(line) {
  return JSON.parse(line);
}
