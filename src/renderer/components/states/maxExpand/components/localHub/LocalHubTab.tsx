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
 * @file LocalHubTab.tsx
 * @description 本地工作台，聚合命令、通知、备份、自动化、剪贴板、邮件、专注、插件、日历与同步。
 * @author 鸡哥
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Blocks,
  CalendarDays,
  Clipboard,
  CloudCog,
  Command,
  Download,
  Mail,
  Play,
  RefreshCw,
  Save,
  Search,
  Timer,
  Upload,
  Workflow,
} from 'lucide-react';
import useIslandStore from '../../../../../store/isLandStore';
import type { MaxExpandTab } from '../../../../../store/types';
import { isLikelyPassword } from '../clipBoardHistory/utils/clipboardHistoryUtils';
import { isHighRiskLocalToolName } from '../agent/utils/chatHelpers';
import {
  buildSafeLocalBackup,
  downloadLocalHubFile,
  loadLocalHubData,
  LOCAL_HUB_CHANGED_EVENT,
  normalizePluginManifest,
  restoreSafeLocalBackup,
  saveLocalHubData,
} from './localHubStorage';
import type {
  LocalAutomationRule,
  LocalCalendarEvent,
  LocalClipboardSnippet,
  LocalHubData,
  LocalHubSection,
} from './localHubTypes';
import '../../../../../styles/localHub/localHub.css';

interface HubCommand {
  id: string;
  label: string;
  keywords: string;
  run: () => void | Promise<void>;
}

const SECTION_ICONS: Record<LocalHubSection, typeof Command> = {
  commands: Command,
  notifications: Bell,
  backup: Save,
  automation: Workflow,
  clipboard: Clipboard,
  mail: Mail,
  focus: Timer,
  plugins: Blocks,
  calendar: CalendarDays,
  sync: CloudCog,
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFocusTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

/**
 * 渲染本地工作台。
 */
export function LocalHubTab(): ReactElement {
  const { t } = useTranslation();
  const setMaxExpandTab = useIslandStore((state) => state.setMaxExpandTab);
  const setNotification = useIslandStore((state) => state.setNotification);
  const [section, setSection] = useState<LocalHubSection>('commands');
  const [data, setData] = useState<LocalHubData>(loadLocalHubData);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleTime, setRuleTime] = useState('09:00');
  const [ruleMessage, setRuleMessage] = useState('');
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippetContent, setSnippetContent] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [pluginManifestText, setPluginManifestText] = useState('');
  const [focusSeconds, setFocusSeconds] = useState(data.focusMinutes * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const persist = (next: LocalHubData): void => {
    setData(next);
    saveLocalHubData(next);
  };

  useEffect(() => {
    const refresh = (): void => setData(loadLocalHubData());
    window.addEventListener(LOCAL_HUB_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_HUB_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!focusRunning) return undefined;
    const timer = window.setInterval(() => {
      setFocusSeconds((current) => {
        if (current > 1) return current - 1;
        window.clearInterval(timer);
        setFocusRunning(false);
        setNotification({
          title: t('localHub.focus.finishedTitle', { defaultValue: '专注完成' }),
          body: t('localHub.focus.finishedBody', { defaultValue: '休息一下，然后开始下一轮。' }),
          type: 'default',
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning, setNotification, t]);

  const commands = useMemo<HubCommand[]>(() => {
    const navigate = (tab: MaxExpandTab): void => setMaxExpandTab(tab);
    const items: HubCommand[] = [
      { id: 'ai', label: t('localHub.commands.ai', { defaultValue: '打开 AI 对话' }), keywords: 'ai chat', run: () => navigate('aiChat') },
      { id: 'todo', label: t('localHub.commands.todo', { defaultValue: '打开待办事项' }), keywords: 'todo task', run: () => navigate('todo') },
      { id: 'files', label: t('localHub.commands.files', { defaultValue: '查找本地文件' }), keywords: 'file search', run: () => navigate('localFileSearch') },
      { id: 'mail', label: t('localHub.commands.mail', { defaultValue: '打开邮箱' }), keywords: 'mail inbox', run: () => navigate('mail') },
      { id: 'clipboard', label: t('localHub.commands.clipboard', { defaultValue: '打开剪贴板历史' }), keywords: 'clipboard copy', run: () => navigate('clipboardHistory') },
      { id: 'settings', label: t('localHub.commands.settings', { defaultValue: '打开设置' }), keywords: 'settings config', run: () => navigate('settings') },
      {
        id: 'screenshot',
        label: t('localHub.commands.screenshot', { defaultValue: '截取当前窗口' }),
        keywords: 'screenshot capture',
        run: async () => {
          await window.api.executeAgentLocalTool({ tool: 'win.screenshot', arguments: {}, workspaces: [] });
        },
      },
    ];
    data.plugins.filter((plugin) => plugin.enabled).forEach((plugin) => {
      plugin.commands.forEach((pluginCommand) => {
        items.push({
          id: `${plugin.id}:${pluginCommand.id}`,
          label: `${plugin.name} · ${pluginCommand.title}`,
          keywords: `${plugin.id} ${pluginCommand.id}`,
          run: async () => {
            if (!pluginCommand.tool) return;
            if (isHighRiskLocalToolName(pluginCommand.tool) && !window.confirm(t('localHub.plugins.highRiskConfirm', { defaultValue: '该插件命令会执行高风险系统操作，是否继续？' }))) return;
            await window.api.executeAgentLocalTool({
              tool: pluginCommand.tool,
              arguments: pluginCommand.arguments || {},
              workspaces: [],
            });
          },
        });
      });
    });
    return items;
  }, [data.plugins, setMaxExpandTab, t]);

  const filteredCommands = commands.filter((command) => {
    const needle = query.trim().toLowerCase();
    return !needle || `${command.label} ${command.keywords}`.toLowerCase().includes(needle);
  });

  const exportBackup = async (): Promise<void> => {
    const backup = await buildSafeLocalBackup();
    downloadLocalHubFile(`eIsland-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
    setStatus(t('localHub.backup.exported', { defaultValue: '备份已导出，敏感凭据未包含。' }));
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await restoreSafeLocalBackup(JSON.parse(await file.text()));
      setData(loadLocalHubData());
      setStatus(t('localHub.backup.restored', { defaultValue: '备份恢复完成，重启应用后全部生效。' }));
    } catch {
      setStatus(t('localHub.backup.invalid', { defaultValue: '备份文件无效或版本不兼容。' }));
    }
  };

  const addRule = (): void => {
    if (!ruleName.trim() || !ruleMessage.trim()) return;
    const rule: LocalAutomationRule = {
      id: createId('rule'),
      name: ruleName.trim(),
      time: ruleTime,
      message: ruleMessage.trim(),
      enabled: true,
      lastRunDate: '',
    };
    persist({ ...data, automationRules: [...data.automationRules, rule] });
    setRuleName('');
    setRuleMessage('');
  };

  const addSnippet = (): void => {
    if (!snippetContent.trim() || isLikelyPassword(snippetContent)) {
      setStatus(t('localHub.clipboard.secretRejected', { defaultValue: '疑似密码或令牌，未保存。' }));
      return;
    }
    const snippet: LocalClipboardSnippet = {
      id: createId('snippet'),
      title: snippetTitle.trim() || snippetContent.trim().slice(0, 24),
      content: snippetContent.trim(),
      createdAt: Date.now(),
    };
    persist({ ...data, snippets: [snippet, ...data.snippets] });
    setSnippetTitle('');
    setSnippetContent('');
  };

  const captureClipboard = async (): Promise<void> => {
    const text = await window.api.clipboardReadText();
    setSnippetContent(text);
    if (isLikelyPassword(text)) setStatus(t('localHub.clipboard.secretDetected', { defaultValue: '检测到疑似敏感内容，不建议保存。' }));
  };

  const addCalendarEvent = (): void => {
    if (!eventTitle.trim() || !eventStartAt) return;
    const event: LocalCalendarEvent = {
      id: createId('event'),
      title: eventTitle.trim(),
      startAt: eventStartAt,
      note: eventNote.trim(),
    };
    persist({ ...data, calendarEvents: [...data.calendarEvents, event].sort((left, right) => left.startAt.localeCompare(right.startAt)) });
    setEventTitle('');
    setEventStartAt('');
    setEventNote('');
  };

  const importPlugin = (): void => {
    try {
      const plugin = normalizePluginManifest(JSON.parse(pluginManifestText));
      if (!plugin) throw new Error('INVALID_PLUGIN');
      persist({ ...data, plugins: [...data.plugins.filter((item) => item.id !== plugin.id), plugin] });
      setPluginManifestText('');
      setStatus(t('localHub.plugins.imported', { defaultValue: '插件清单已导入。' }));
    } catch {
      setStatus(t('localHub.plugins.invalid', { defaultValue: '插件清单格式无效。' }));
    }
  };

  const renderCommands = (): ReactElement => (
    <div className="local-hub-panel">
      <div className="local-hub-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('localHub.commands.search', { defaultValue: '搜索命令…' })} autoFocus /></div>
      <div className="local-hub-list">
        {filteredCommands.map((command) => <button className="local-hub-list-item" key={command.id} type="button" onClick={() => void command.run()}><Play size={15} /><span>{command.label}</span></button>)}
      </div>
      <p className="local-hub-hint">{t('localHub.commands.shortcut', { defaultValue: '在应用中按 Ctrl+K 可随时打开本地工作台。' })}</p>
    </div>
  );

  const renderNotifications = (): ReactElement => (
    <div className="local-hub-panel">
      <div className="local-hub-toolbar">
        <strong>{t('localHub.notifications.title', { defaultValue: '通知历史' })}</strong>
        <button type="button" onClick={() => persist({ ...data, notifications: [] })}>{t('localHub.common.clear', { defaultValue: '清空' })}</button>
      </div>
      <div className="local-hub-list">
        {data.notifications.map((item) => <div className="local-hub-card" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()} · {item.type}</small></div>)}
        {data.notifications.length === 0 && <p className="local-hub-empty">{t('localHub.notifications.empty', { defaultValue: '暂无通知记录' })}</p>}
      </div>
    </div>
  );

  const renderBackup = (): ReactElement => (
    <div className="local-hub-panel local-hub-centered">
      <Save size={42} />
      <h3>{t('localHub.backup.title', { defaultValue: '本地备份与恢复' })}</h3>
      <p>{t('localHub.backup.hint', { defaultValue: '导出待办、备忘录、闹钟、收藏、工作台等本地数据，不包含密码、令牌和 API Key。' })}</p>
      <div className="local-hub-actions">
        <button type="button" onClick={() => void exportBackup()}><Download size={16} />{t('localHub.backup.export', { defaultValue: '导出备份' })}</button>
        <button type="button" onClick={() => importInputRef.current?.click()}><Upload size={16} />{t('localHub.backup.import', { defaultValue: '恢复备份' })}</button>
        <input ref={importInputRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importBackup(event)} />
      </div>
    </div>
  );

  const renderAutomation = (): ReactElement => (
    <div className="local-hub-panel">
      <div className="local-hub-form-row"><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={t('localHub.automation.name', { defaultValue: '规则名称' })} /><input type="time" value={ruleTime} onChange={(event) => setRuleTime(event.target.value)} /><input value={ruleMessage} onChange={(event) => setRuleMessage(event.target.value)} placeholder={t('localHub.automation.message', { defaultValue: '提醒内容' })} /><button type="button" onClick={addRule}>{t('localHub.common.add', { defaultValue: '添加' })}</button></div>
      <div className="local-hub-list">{data.automationRules.map((rule) => <div className="local-hub-card local-hub-card-row" key={rule.id}><div><strong>{rule.name}</strong><p>{rule.time} · {rule.message}</p></div><div><button type="button" onClick={() => setNotification({ title: rule.name, body: rule.message, type: 'default' })}>{t('localHub.automation.run', { defaultValue: '运行' })}</button><button type="button" onClick={() => persist({ ...data, automationRules: data.automationRules.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item) })}>{rule.enabled ? t('localHub.common.enabled', { defaultValue: '已启用' }) : t('localHub.common.disabled', { defaultValue: '已停用' })}</button><button type="button" onClick={() => persist({ ...data, automationRules: data.automationRules.filter((item) => item.id !== rule.id) })}>{t('localHub.common.delete', { defaultValue: '删除' })}</button></div></div>)}</div>
    </div>
  );

  const renderClipboard = (): ReactElement => (
    <div className="local-hub-panel">
      <div className="local-hub-form-row"><input value={snippetTitle} onChange={(event) => setSnippetTitle(event.target.value)} placeholder={t('localHub.clipboard.title', { defaultValue: '片段名称' })} /><textarea value={snippetContent} onChange={(event) => setSnippetContent(event.target.value)} placeholder={t('localHub.clipboard.content', { defaultValue: '常用文本内容' })} /><button type="button" onClick={() => void captureClipboard()}>{t('localHub.clipboard.capture', { defaultValue: '读取剪贴板' })}</button><button type="button" onClick={addSnippet}>{t('localHub.common.save', { defaultValue: '保存' })}</button></div>
      <div className="local-hub-list">{data.snippets.map((snippet) => <div className="local-hub-card local-hub-card-row" key={snippet.id}><div><strong>{snippet.title}</strong><p>{snippet.content}</p></div><div><button type="button" onClick={() => void window.api.clipboardWriteText(snippet.content)}>{t('localHub.common.copy', { defaultValue: '复制' })}</button><button type="button" onClick={() => persist({ ...data, snippets: data.snippets.filter((item) => item.id !== snippet.id) })}>{t('localHub.common.delete', { defaultValue: '删除' })}</button></div></div>)}</div>
    </div>
  );

  const renderMail = (): ReactElement => (
    <div className="local-hub-panel local-hub-centered">
      <Mail size={42} />
      <h3>{t('localHub.mail.title', { defaultValue: '邮件助手' })}</h3>
      <p>{t('localHub.mail.hint', { defaultValue: '使用现有 IMAP 账号查看邮件；后台轮询偏好保存在本机。' })}</p>
      <label>{t('localHub.mail.interval', { defaultValue: '后台检查间隔（分钟）' })}<input type="number" min="1" max="120" value={data.mailBackgroundMinutes} onChange={(event) => persist({ ...data, mailBackgroundMinutes: Math.max(1, Number(event.target.value) || 10) })} /></label>
      <button type="button" onClick={() => setMaxExpandTab('mail')}>{t('localHub.mail.open', { defaultValue: '打开收件箱' })}</button>
    </div>
  );

  const renderFocus = (): ReactElement => (
    <div className="local-hub-panel local-hub-centered">
      <div className="local-hub-focus-time">{formatFocusTime(focusSeconds)}</div>
      <div className="local-hub-actions"><button type="button" onClick={() => setFocusRunning((current) => !current)}>{focusRunning ? t('localHub.focus.pause', { defaultValue: '暂停' }) : t('localHub.focus.start', { defaultValue: '开始专注' })}</button><button type="button" onClick={() => { setFocusRunning(false); setFocusSeconds(data.focusMinutes * 60); }}><RefreshCw size={16} />{t('localHub.focus.reset', { defaultValue: '重置' })}</button></div>
      <label>{t('localHub.focus.minutes', { defaultValue: '专注分钟数' })}<input type="number" min="1" max="180" value={data.focusMinutes} onChange={(event) => { const minutes = Math.max(1, Number(event.target.value) || 25); persist({ ...data, focusMinutes: minutes }); if (!focusRunning) setFocusSeconds(minutes * 60); }} /></label>
    </div>
  );

  const renderPlugins = (): ReactElement => (
    <div className="local-hub-panel">
      <textarea className="local-hub-manifest" value={pluginManifestText} onChange={(event) => setPluginManifestText(event.target.value)} placeholder={t('localHub.plugins.example', { defaultValue: '{"id":"example","name":"Example","version":"1.0.0","commands":[{"id":"info","title":"System Info","tool":"sys.info"}]}' })}/>
      <button type="button" onClick={importPlugin}>{t('localHub.plugins.import', { defaultValue: '导入声明式插件' })}</button>
      <p className="local-hub-hint">{t('localHub.plugins.hint', { defaultValue: '本地插件只注册声明式命令，不执行任意 JavaScript；高风险工具仍需确认。' })}</p>
      <div className="local-hub-list">{data.plugins.map((plugin) => <div className="local-hub-card local-hub-card-row" key={plugin.id}><div><strong>{plugin.name} · {plugin.version}</strong><p>{plugin.description || `${plugin.commands.length} commands`}</p></div><div><button type="button" onClick={() => persist({ ...data, plugins: data.plugins.map((item) => item.id === plugin.id ? { ...item, enabled: !item.enabled } : item) })}>{plugin.enabled ? t('localHub.common.enabled', { defaultValue: '已启用' }) : t('localHub.common.disabled', { defaultValue: '已停用' })}</button><button type="button" onClick={() => persist({ ...data, plugins: data.plugins.filter((item) => item.id !== plugin.id) })}>{t('localHub.common.delete', { defaultValue: '删除' })}</button></div></div>)}</div>
    </div>
  );

  const renderCalendar = (): ReactElement => (
    <div className="local-hub-panel">
      <div className="local-hub-form-row"><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder={t('localHub.calendar.title', { defaultValue: '日程标题' })} /><input type="datetime-local" value={eventStartAt} onChange={(event) => setEventStartAt(event.target.value)} /><input value={eventNote} onChange={(event) => setEventNote(event.target.value)} placeholder={t('localHub.calendar.note', { defaultValue: '备注' })} /><button type="button" onClick={addCalendarEvent}>{t('localHub.common.add', { defaultValue: '添加' })}</button></div>
      <div className="local-hub-list">{data.calendarEvents.map((event) => <div className="local-hub-card local-hub-card-row" key={event.id}><div><strong>{event.title}</strong><p>{new Date(event.startAt).toLocaleString()} · {event.note}</p></div><button type="button" onClick={() => persist({ ...data, calendarEvents: data.calendarEvents.filter((item) => item.id !== event.id) })}>{t('localHub.common.delete', { defaultValue: '删除' })}</button></div>)}</div>
    </div>
  );

  const renderSync = (): ReactElement => (
    <div className="local-hub-panel local-hub-centered">
      <CloudCog size={42} />
      <h3>{t('localHub.sync.title', { defaultValue: '本地同步' })}</h3>
      <p>{t('localHub.sync.hint', { defaultValue: '通过加密盘、NAS 或其他同步文件夹传递备份文件；应用本身不会上传你的数据。' })}</p>
      <button type="button" onClick={() => void exportBackup()}><Download size={16} />{t('localHub.sync.snapshot', { defaultValue: '生成同步快照' })}</button>
    </div>
  );

  const content: Record<LocalHubSection, () => ReactElement> = {
    commands: renderCommands,
    notifications: renderNotifications,
    backup: renderBackup,
    automation: renderAutomation,
    clipboard: renderClipboard,
    mail: renderMail,
    focus: renderFocus,
    plugins: renderPlugins,
    calendar: renderCalendar,
    sync: renderSync,
  };

  const sections = Object.keys(SECTION_ICONS) as LocalHubSection[];
  return (
    <div className="local-hub-root" onClick={(event) => event.stopPropagation()}>
      <aside className="local-hub-sidebar">
        <h2>{t('localHub.title', { defaultValue: '本地工作台' })}</h2>
        {sections.map((item) => {
          const Icon = SECTION_ICONS[item];
          return <button className={section === item ? 'active' : ''} key={item} type="button" onClick={() => { setSection(item); setStatus(''); }}><Icon size={16} /><span>{t(`localHub.sections.${item}`, { defaultValue: item })}</span></button>;
        })}
      </aside>
      <main className="local-hub-content">
        {status && <div className="local-hub-status">{status}</div>}
        {content[section]()}
      </main>
    </div>
  );
}
