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
 * @file localHubTypes.ts
 * @description 本地工作台的数据模型。
 * @author 鸡哥
 */

export type LocalHubSection = 'commands' | 'notifications' | 'backup' | 'automation' | 'clipboard' | 'mail' | 'focus' | 'plugins' | 'calendar' | 'sync';

export interface LocalNotificationEntry {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: number;
  read: boolean;
}

export interface LocalAutomationRule {
  id: string;
  name: string;
  time: string;
  message: string;
  enabled: boolean;
  lastRunDate: string;
}

export interface LocalClipboardSnippet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface LocalCalendarEvent {
  id: string;
  title: string;
  startAt: string;
  note: string;
}

export interface LocalPluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  commands: Array<{ id: string; title: string; tool?: string; arguments?: Record<string, unknown> }>;
}

export interface LocalHubData {
  notifications: LocalNotificationEntry[];
  automationRules: LocalAutomationRule[];
  snippets: LocalClipboardSnippet[];
  calendarEvents: LocalCalendarEvent[];
  plugins: LocalPluginManifest[];
  mailBackgroundMinutes: number;
  focusMinutes: number;
}
