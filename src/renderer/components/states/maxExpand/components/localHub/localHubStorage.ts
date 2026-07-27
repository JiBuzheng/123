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
 */

/**
 * @file localHubStorage.ts
 * @description 本地工作台持久化、通知归档与安全备份工具。
 * @author 鸡哥
 */

import type { NotificationData } from '../../../../../store/types';
import type { LocalHubData, LocalPluginManifest } from './localHubTypes';

export const LOCAL_HUB_STORE_KEY = 'local-hub-data-v1';
export const LOCAL_HUB_STORAGE_KEY = 'eIsland_local_hub_v1';
export const LOCAL_HUB_CHANGED_EVENT = 'eisland:local-hub-changed';

const DEFAULT_DATA: LocalHubData = {
  notifications: [],
  automationRules: [],
  snippets: [],
  calendarEvents: [],
  plugins: [],
  mailBackgroundMinutes: 10,
  focusMinutes: 25,
};

const BACKUP_STORE_KEYS = [
  'todos',
  'memos',
  'alarms',
  'url-favorites',
  'clipboard-history-recent',
  LOCAL_HUB_STORE_KEY,
];

function emitChanged(): void {
  window.dispatchEvent(new CustomEvent(LOCAL_HUB_CHANGED_EVENT));
}

/**
 * 规范化插件清单，清除不可执行或危险的任意代码字段。
 * @param value - 外部导入的插件清单。
 * @returns 安全的声明式插件清单；无效时返回 null。
 */
export function normalizePluginManifest(value: unknown): LocalPluginManifest | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim().replace(/[^a-z0-9._-]/gi, '') : '';
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 80) : '';
  const version = typeof source.version === 'string' ? source.version.trim().slice(0, 30) : '';
  if (!id || !name || !version) return null;
  const commands = Array.isArray(source.commands)
    ? source.commands.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const command = item as Record<string, unknown>;
      const commandId = typeof command.id === 'string' ? command.id.trim().replace(/[^a-z0-9._-]/gi, '') : '';
      const title = typeof command.title === 'string' ? command.title.trim().slice(0, 100) : '';
      if (!commandId || !title) return [];
      return [{
        id: commandId,
        title,
        tool: typeof command.tool === 'string' ? command.tool.trim() : undefined,
        arguments: command.arguments && typeof command.arguments === 'object'
          ? command.arguments as Record<string, unknown>
          : undefined,
      }];
    })
    : [];
  return {
    id,
    name,
    version,
    description: typeof source.description === 'string' ? source.description.trim().slice(0, 300) : '',
    enabled: source.enabled !== false,
    commands,
  };
}

/**
 * 从本地缓存读取工作台数据。
 * @returns 已规范化的工作台数据。
 */
export function loadLocalHubData(): LocalHubData {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_HUB_STORAGE_KEY) || '{}') as Partial<LocalHubData>;
    return {
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications.slice(0, 200) : [],
      automationRules: Array.isArray(parsed.automationRules) ? parsed.automationRules : [],
      snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
      calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [],
      plugins: Array.isArray(parsed.plugins)
        ? parsed.plugins.map(normalizePluginManifest).filter((item): item is LocalPluginManifest => item !== null)
        : [],
      mailBackgroundMinutes: Number.isFinite(parsed.mailBackgroundMinutes) ? Math.max(1, Number(parsed.mailBackgroundMinutes)) : 10,
      focusMinutes: Number.isFinite(parsed.focusMinutes) ? Math.max(1, Number(parsed.focusMinutes)) : 25,
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

/**
 * 保存工作台数据并通知所有渲染组件刷新。
 * @param data - 完整工作台数据。
 */
export function saveLocalHubData(data: LocalHubData): void {
  localStorage.setItem(LOCAL_HUB_STORAGE_KEY, JSON.stringify(data));
  void window.api?.storeWrite?.(LOCAL_HUB_STORE_KEY, data).catch(() => {});
  emitChanged();
}

/**
 * 将岛内通知写入本地历史。
 * @param notification - 当前通知数据。
 */
export function recordLocalNotification(notification: NotificationData): void {
  if (!notification.title && !notification.body) return;
  const data = loadLocalHubData();
  data.notifications.unshift({
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: notification.title,
    body: notification.body,
    type: notification.type || 'default',
    createdAt: Date.now(),
    read: false,
  });
  data.notifications = data.notifications.slice(0, 200);
  saveLocalHubData(data);
}

/**
 * 构建不包含账号令牌、密码与 API 密钥的本地备份。
 * @returns 可序列化的备份对象。
 */
export async function buildSafeLocalBackup(): Promise<Record<string, unknown>> {
  const local: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('eIsland_')) continue;
    if (/token|password|secret|api.?key|profile/i.test(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) local[key] = value;
  }
  const store: Record<string, unknown> = {};
  await Promise.all(BACKUP_STORE_KEYS.map(async (key) => {
    const value = await window.api?.storeRead?.(key).catch(() => null);
    if (value !== null && value !== undefined) store[key] = value;
  }));
  return {
    format: 'eIsland-local-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    local,
    store,
  };
}

/**
 * 恢复经过校验的本地备份。
 * @param backup - 解析后的备份对象。
 */
export async function restoreSafeLocalBackup(backup: unknown): Promise<void> {
  if (!backup || typeof backup !== 'object') throw new Error('INVALID_BACKUP');
  const source = backup as Record<string, unknown>;
  if (source.format !== 'eIsland-local-backup' || source.version !== 1) throw new Error('INVALID_BACKUP');
  if (source.local && typeof source.local === 'object') {
    Object.entries(source.local as Record<string, unknown>).forEach(([key, value]) => {
      if (!key.startsWith('eIsland_') || typeof value !== 'string') return;
      if (/token|password|secret|api.?key|profile/i.test(key)) return;
      localStorage.setItem(key, value);
    });
  }
  if (source.store && typeof source.store === 'object') {
    await Promise.all(Object.entries(source.store as Record<string, unknown>).map(async ([key, value]) => {
      if (!BACKUP_STORE_KEYS.includes(key)) return;
      await window.api?.storeWrite?.(key, value);
    }));
  }
  emitChanged();
}

/**
 * 下载文本文件。
 * @param fileName - 下载文件名。
 * @param content - 文件内容。
 */
export function downloadLocalHubFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
