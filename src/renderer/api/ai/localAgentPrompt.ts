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
 * @file localAgentPrompt.ts
 * @description 构建完全离线的 Agent 系统提示词，避免本地模型依赖远程账号或付费服务。
 * @author 鸡哥
 */

interface LocalPromptOptions {
  agentMode?: string;
  workspaces?: string[];
  skills?: Array<{ name: string; content: string }>;
}

const LOCAL_TOOL_NAMES = [
  'file.list', 'file.exists', 'file.stat', 'file.mkdir', 'file.read', 'file.read.lines',
  'file.write', 'file.delete', 'file.grep', 'file.search', 'file.rename', 'file.copy',
  'file.append', 'file.replace', 'file.tree', 'file.compress', 'file.extract', 'file.hash',
  'file.trash', 'cmd.exec', 'cmd.powershell', 'sys.info', 'sys.env', 'sys.open',
  'sys.installed-apps', 'sys.launch', 'sys.nowplaying', 'win.list', 'win.minimize',
  'win.maximize', 'win.restore', 'win.close', 'win.screenshot', 'clipboard.read',
  'clipboard.write', 'notification.send', 'web.search', 'net.ping', 'net.dns', 'net.ports',
  'net.proxy', 'net.hosts', 'monitor.cpu', 'monitor.memory', 'monitor.disk', 'monitor.gpu',
  'volume.get', 'volume.set', 'brightness.get', 'brightness.set', 'display.list',
  'power.sleep', 'power.shutdown', 'power.restart', 'wifi.list', 'registry.read',
  'registry.write', 'registry.delete', 'service.list', 'service.start', 'service.stop',
  'service.restart', 'schedule.task.list', 'schedule.task.create', 'firewall.rules',
  'defender.scan', 'island.settings.list', 'island.settings.read', 'island.settings.write',
  'island.theme.get', 'island.theme.set', 'island.opacity.get', 'island.opacity.set',
  'island.restart', 'alarm.list', 'alarm.create', 'alarm.delete', 'alarm.toggle',
  'alarm.update', 'todolist.list', 'todolist.create', 'todolist.delete', 'todolist.toggle',
  'todolist.update',
];

/**
 * 构建本地 Agent 系统提示词。
 * @param options - Agent 模式、授权工作区与用户启用的技能。
 * @returns 可直接提交给本地或自定义模型的系统提示词。
 */
export function buildLocalAgentSystemPrompt(options: LocalPromptOptions): string {
  const workspaces = (options.workspaces ?? []).filter(Boolean);
  const skills = (options.skills ?? []).filter((skill) => skill.name && skill.content);
  const parts = [
    '你是 eIsland 本地桌面助手。你直接服务当前用户，不依赖 eIsland 云端账号或订阅。',
    '回答应准确、简洁。需要操作电脑时可以调用本地工具；不要声称已执行尚未执行的操作。',
    '每轮只能输出一个 JSON 对象。调用工具时输出：{"type":"tool_call","tool":"工具名","purpose":"用途","arguments":{}}。完成时输出：{"type":"final","answer":"最终回答"}。',
    `可用工具：${LOCAL_TOOL_NAMES.join(', ')}。`,
    '删除文件、关闭窗口、关机重启、修改注册表/服务/代理/hosts 等高风险动作会由客户端再次确认。',
  ];
  if (options.agentMode) {
    parts.push(`当前交互模式：${options.agentMode}。`);
  }
  if (workspaces.length > 0) {
    parts.push(`允许访问的工作区：${workspaces.join('；')}。文件操作必须限制在这些目录内。`);
  }
  if (skills.length > 0) {
    parts.push(`用户启用的技能：\n${skills.map((skill) => `## ${skill.name}\n${skill.content}`).join('\n\n')}`);
  }
  return parts.join('\n\n');
}
