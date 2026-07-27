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
 * @file localHubStorage.test.ts
 * @description 本地工作台存储与插件清单安全测试。
 * @author 鸡哥
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSafeLocalBackup,
  loadLocalHubData,
  normalizePluginManifest,
  saveLocalHubData,
} from './localHubStorage';

describe('localHubStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        storeRead: vi.fn(async () => null),
        storeWrite: vi.fn(async () => true),
      },
    });
  });

  it('persists local hub data', () => {
    const data = loadLocalHubData();
    data.focusMinutes = 45;
    saveLocalHubData(data);
    expect(loadLocalHubData().focusMinutes).toBe(45);
  });

  it('excludes credentials from backups', async () => {
    localStorage.setItem('eIsland_todos', '[]');
    localStorage.setItem('eIsland_api_key', 'secret');
    const backup = await buildSafeLocalBackup();
    expect(backup.local).toEqual({ eIsland_todos: '[]' });
  });

  it('accepts declarative commands and discards arbitrary code fields', () => {
    const plugin = normalizePluginManifest({
      id: 'system-info',
      name: 'System Info',
      version: '1.0.0',
      script: 'dangerous()',
      commands: [{ id: 'info', title: 'Info', tool: 'sys.info' }],
    });
    expect(plugin?.commands[0].tool).toBe('sys.info');
    expect(plugin).not.toHaveProperty('script');
  });
});
