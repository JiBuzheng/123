/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file store.ts
 * @description 通用存储 IPC 处理模块
 * @description 处理通用键值存储的读取和写入操作
 * @author 鸡哥
 */

import { ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { broadcastSettingChange } from '../../utils/broadcast';
import type { RegisterStoreIpcHandlersOptions } from './types';
import { isTrustedIpcSender } from '../../utils/ipcSecurity';

const SENSITIVE_STORE_KEYS = new Set([
  'user-account-token',
  'mail-account-config',
  'mail-accounts-config',
  'ai-api-key',
]);

interface EncryptedStoreEnvelope {
  __eislandEncrypted: 1;
  data: string;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedStoreEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.__eislandEncrypted === 1 && typeof row.data === 'string';
}

function encodeStoreValue(key: string, data: unknown): string {
  const serialized = JSON.stringify(data);
  if (!SENSITIVE_STORE_KEYS.has(key)) {
    return JSON.stringify(data, null, 2);
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统安全存储当前不可用');
  }
  const envelope: EncryptedStoreEnvelope = {
    __eislandEncrypted: 1,
    data: safeStorage.encryptString(serialized).toString('base64'),
  };
  return JSON.stringify(envelope, null, 2);
}

function decodeStoreValue(key: string, raw: string): { value: unknown; migratedContent?: string } {
  const parsed = JSON.parse(raw) as unknown;
  if (!SENSITIVE_STORE_KEYS.has(key)) return { value: parsed };
  if (isEncryptedEnvelope(parsed)) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统安全存储当前不可用');
    }
    const decrypted = safeStorage.decryptString(Buffer.from(parsed.data, 'base64'));
    return { value: JSON.parse(decrypted) as unknown };
  }
  return {
    value: parsed,
    migratedContent: encodeStoreValue(key, parsed),
  };
}

/** 合法的 store key：不含路径分隔符和 traversal 片段 */
function isValidStoreKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && !/[\\/]/.test(key) && !key.includes('..');
}

/**
 * 注册通用存储 IPC 处理器
 * @description 注册通用键值存储读写 IPC 事件处理器
 * @param options - 配置选项，包含存储目录
 */
export function registerStoreIpcHandlers(options: RegisterStoreIpcHandlersOptions): void {
  ipcMain.handle('store:read', (event, key: string) => {
    try {
      if (!isTrustedIpcSender(event)) return null;
      if (!isValidStoreKey(key)) return null;
      const filePath = join(options.storeDir, `${key}.json`);
      if (!existsSync(filePath)) return null;
      const raw = readFileSync(filePath, 'utf-8');
      const decoded = decodeStoreValue(key, raw);
      if (decoded.migratedContent) {
        writeFileSync(filePath, decoded.migratedContent, 'utf-8');
      }
      return decoded.value;
    } catch (err) {
      console.error(`[Store] read '${key}' error:`, err);
      return null;
    }
  });

  ipcMain.handle('store:write', (event, key: string, data: unknown) => {
    try {
      if (!isTrustedIpcSender(event)) throw new Error('Untrusted IPC sender');
      if (!isValidStoreKey(key)) throw new Error('Invalid store key');
      const filePath = join(options.storeDir, `${key}.json`);
      writeFileSync(filePath, encodeStoreValue(key, data), 'utf-8');
      broadcastSettingChange(event.sender.id, `store:${key}`, data);
      return true;
    } catch (err) {
      console.error(`[Store] write '${key}' error:`, err);
      throw err;
    }
  });
}
