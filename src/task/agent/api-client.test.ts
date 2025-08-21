// API 客户端测试文件
// 注意：这是一个简单的测试文件，用于验证基本功能

import { createApiClient, OpenAIClient, ClaudeClient } from './api-client';

// 测试 OpenAI 客户端创建
export function testOpenAIClient() {
  try {
    const client = createApiClient('openai', {
      apiKey: 'test-key',
      model: 'gpt-3.5-turbo'
    });
    console.log('OpenAI 客户端创建成功:', client instanceof OpenAIClient);
    return true;
  } catch (error) {
    console.error('OpenAI 客户端创建失败:', error);
    return false;
  }
}

// 测试 Claude 客户端创建
export function testClaudeClient() {
  try {
    const client = createApiClient('claude', {
      apiKey: 'test-key',
      model: 'claude-3-haiku-20240307'
    });
    console.log('Claude 客户端创建成功:', client instanceof ClaudeClient);
    return true;
  } catch (error) {
    console.error('Claude 客户端创建失败:', error);
    return false;
  }
}

// 测试无效类型
export function testInvalidType() {
  try {
    createApiClient('invalid' as any, {
      apiKey: 'test-key',
      model: 'test-model'
    });
    console.error('应该抛出错误但没有');
    return false;
  } catch (error) {
    console.log('无效类型正确处理:', error instanceof Error);
    return true;
  }
}

// 运行所有测试
export function runAllTests() {
  console.log('开始运行 API 客户端测试...');
  
  const results = [
    testOpenAIClient(),
    testClaudeClient(),
    testInvalidType()
  ];
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`测试完成: ${passed}/${total} 通过`);
  
  return passed === total;
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中
  (window as any).testApiClient = runAllTests;
} else {
  // 在 Node.js 环境中
  runAllTests();
}
