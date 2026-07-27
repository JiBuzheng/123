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
 * @file ipcSecurity.ts
 * @description 主进程 IPC 调用来源校验，仅允许应用自身的顶层渲染 frame。
 * @author 鸡哥
 */

import type { IpcMainEvent, IpcMainInvokeEvent, WebFrameMain } from 'electron';

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent;

function isTrustedFrameUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:' || url.protocol === 'app:') return true;
    const isLocalDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return isLocalDevHost && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

/** 仅允许交给系统浏览器或邮件客户端处理的公开协议。 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** 判断 IPC 是否来自应用自身可信的顶层 frame。 */
export function isTrustedIpcSender(event: IpcEvent): boolean {
  const senderFrame = event.senderFrame;
  const mainFrame = event.sender?.mainFrame as WebFrameMain | undefined;
  if (!senderFrame || !mainFrame || senderFrame !== mainFrame) return false;
  return isTrustedFrameUrl(senderFrame.url);
}
