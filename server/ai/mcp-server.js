import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'win-messenger-tools',
  version: '1.0.0',
});

server.tool('get_current_time', '현재 날짜와 시간을 반환합니다', {}, async () => {
  const now = new Date();
  const formatted = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { content: [{ type: 'text', text: `현재 시각: ${formatted}` }] };
});

server.tool(
  'get_weather',
  '도시의 날씨 정보를 반환합니다',
  { city: z.string().describe('도시 이름 (예: 서울, 부산)') },
  async ({ city }) => {
    const weatherData = {
      서울: { temp: 24, condition: '맑음', humidity: 45 },
      부산: { temp: 26, condition: '구름 조금', humidity: 60 },
      대구: { temp: 28, condition: '맑음', humidity: 40 },
      인천: { temp: 23, condition: '흐림', humidity: 55 },
      대전: { temp: 25, condition: '맑음', humidity: 42 },
    };
    const data = weatherData[city] || { temp: 22, condition: '정보 없음', humidity: 50 };
    return {
      content: [
        {
          type: 'text',
          text: `${city} 날씨: ${data.condition}, 기온 ${data.temp}°C, 습도 ${data.humidity}%`,
        },
      ],
    };
  }
);

server.tool(
  'calculate',
  '수학 계산을 수행합니다',
  { expression: z.string().describe('계산할 수식 (예: 2 + 3 * 4)') },
  async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { content: [{ type: 'text', text: `${expression} = ${result}` }] };
    } catch {
      return { content: [{ type: 'text', text: `계산 오류: "${expression}"을 계산할 수 없습니다` }] };
    }
  }
);

server.tool(
  'translate_hint',
  '간단한 번역 힌트를 제공합니다',
  {
    text: z.string().describe('번역할 텍스트'),
    targetLang: z.string().describe('목표 언어 (예: 영어, 일본어, 중국어)'),
  },
  async ({ text, targetLang }) => {
    return {
      content: [
        {
          type: 'text',
          text: `"${text}"을(를) ${targetLang}로 번역 요청을 받았습니다. AI가 직접 번역을 수행합니다.`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
