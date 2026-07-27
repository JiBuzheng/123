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
 * @file useLocalHubRuntime.ts
 * @description 本地工作台全局运行时：快捷命令入口、定时自动化与日历提醒。
 * @author 鸡哥
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../store/isLandStore';
import {
  loadLocalHubData,
  saveLocalHubData,
} from '../states/maxExpand/components/localHub/localHubStorage';
import {
  fetchInbox,
  readMailAccountState,
  readStoredFetchLimit,
} from '../states/maxExpand/components/mail/utils/mailUtils';

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 启动本地工作台的常驻事件处理。
 */
export function useLocalHubRuntime(): void {
  const { t } = useTranslation();
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      const store = useIslandStore.getState();
      store.setMaxExpand();
      store.setMaxExpandTab('localHub');
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const checkSchedules = (): void => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dateKey = getLocalDateKey(now);
      const data = loadLocalHubData();
      let changed = false;
      const scheduledNotifications: Array<{ title: string; body: string }> = [];

      data.automationRules.forEach((rule) => {
        if (!rule.enabled || rule.time !== time || rule.lastRunDate === dateKey) return;
        rule.lastRunDate = dateKey;
        changed = true;
        scheduledNotifications.push({
          title: rule.name,
          body: rule.message,
        });
      });

      data.calendarEvents.forEach((event) => {
        const start = new Date(event.startAt);
        if (Number.isNaN(start.getTime())) return;
        const distance = start.getTime() - now.getTime();
        const reminderKey = `calendar:${event.id}:${dateKey}`;
        if (distance < 0 || distance > 60_000 || sessionStorage.getItem(reminderKey)) return;
        sessionStorage.setItem(reminderKey, '1');
        scheduledNotifications.push({
          title: event.title,
          body: event.note || start.toLocaleString(),
        });
      });

      if (changed) saveLocalHubData(data);
      scheduledNotifications.forEach((notification) => {
        useIslandStore.getState().setNotification({ ...notification, type: 'default' });
      });
    };
    checkSchedules();
    const timer = window.setInterval(checkSchedules, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lastCheckedAt = 0;
    const checkMail = async (): Promise<void> => {
      const hub = loadLocalHubData();
      const intervalMs = Math.max(1, hub.mailBackgroundMinutes) * 60_000;
      if (Date.now() - lastCheckedAt < intervalMs) return;
      lastCheckedAt = Date.now();
      const [accountState, limit] = await Promise.all([readMailAccountState(), readStoredFetchLimit()]);
      if (cancelled || !accountState.activeAccount) return;
      const inbox = await fetchInbox(
        accountState.activeAccount,
        limit,
        t('mailTab.messages.inboxFetchTimeout', { defaultValue: '收件箱读取超时，请检查网络或邮箱配置' }),
      );
      if (cancelled || !inbox || inbox.length === 0) return;
      const markerKey = `eIsland_mail_latest_${accountState.activeAccount.id}`;
      const previousUid = localStorage.getItem(markerKey);
      const latestUid = inbox[0].uid;
      localStorage.setItem(markerKey, latestUid);
      if (!previousUid || previousUid === latestUid) return;
      useIslandStore.getState().setNotification({
        title: t('localHub.mail.newMailTitle', { defaultValue: '收到新邮件' }),
        body: inbox[0].subject || inbox[0].from || t('mailTab.fallbacks.noSubject', { defaultValue: '(无主题)' }),
        type: 'default',
      });
    };
    void checkMail();
    const timer = window.setInterval(() => void checkMail(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t]);
}
