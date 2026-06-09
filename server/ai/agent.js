import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let agent = null;
let mcpClient = null;
let mcpTransport = null;

function zodSchemaFromMCP(inputSchema) {
  if (!inputSchema || !inputSchema.properties) return z.object({});
  const shape = {};
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    let field;
    switch (prop.type) {
      case 'number':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      default:
        field = z.string();
    }
    if (prop.description) field = field.describe(prop.description);
    const required = inputSchema.required || [];
    if (!required.includes(key)) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}

async function initAgent() {
  mcpTransport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, 'mcp-server.js')],
  });

  mcpClient = new Client({ name: 'win-messenger-client', version: '1.0.0' });
  await mcpClient.connect(mcpTransport);

  const { tools: mcpTools } = await mcpClient.listTools();
  console.log(`[MCP] ${mcpTools.length}개 도구 로드됨:`, mcpTools.map((t) => t.name));

  const langchainTools = mcpTools.map(
    (tool) =>
      new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || '',
        schema: zodSchemaFromMCP(tool.inputSchema),
        func: async (input) => {
          const result = await mcpClient.callTool({ name: tool.name, arguments: input });
          return result.content.map((c) => c.text).join('\n');
        },
      })
  );

  const model = new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 1024,
  });

  agent = createReactAgent({
    llm: model,
    tools: langchainTools,
    messageModifier:
      '당신은 친절한 한국어 AI 어시스턴트입니다. 메신저 채팅에서 사용자를 돕습니다. ' +
      '답변은 간결하고 자연스럽게 해주세요. 도구를 적극적으로 활용하세요.',
  });

  console.log('[Agent] LangChain ReAct 에이전트 초기화 완료');
}

async function invokeAgent(userMessage, conversationHistory = []) {
  if (!agent) {
    return 'AI 어시스턴트가 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.';
  }

  try {
    const messages = conversationHistory.slice(-10).map((msg) =>
      msg.type === 'ai'
        ? new AIMessage(msg.text)
        : new HumanMessage(msg.text)
    );
    messages.push(new HumanMessage(userMessage));

    const result = await agent.invoke({ messages });
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.content || '응답을 생성할 수 없었습니다.';
  } catch (error) {
    console.error('[Agent] 에러:', error.message);
    return `죄송합니다, 오류가 발생했습니다: ${error.message}`;
  }
}

async function shutdownAgent() {
  if (mcpTransport) {
    await mcpTransport.close();
    console.log('[Agent] MCP 연결 종료');
  }
}

export { initAgent, invokeAgent, shutdownAgent };
