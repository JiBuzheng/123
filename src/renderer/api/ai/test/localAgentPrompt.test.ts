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
 * @file localAgentPrompt.test.ts
 * @description 本地 Agent 提示词测试。
 * @author 鸡哥
 */

import { describe, expect, it } from 'vitest';
import { buildLocalAgentSystemPrompt } from '../localAgentPrompt';

describe('buildLocalAgentSystemPrompt', () => {
  it('contains local tools and does not require a cloud subscription', () => {
    const prompt = buildLocalAgentSystemPrompt({
      agentMode: 'mihtnelis',
      workspaces: ['C:\\workspace'],
      skills: [{ name: 'review', content: 'Review files carefully.' }],
    });

    expect(prompt).toContain('不依赖 eIsland 云端账号或订阅');
    expect(prompt).toContain('file.read');
    expect(prompt).toContain('C:\\workspace');
    expect(prompt).toContain('Review files carefully.');
  });
});
