function splitToChunks(text, chunkSize = 8) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export class ChatService {
  async *streamReply(request) {
    const userText = String(request?.text || '').trim();
    if (!userText) {
      const error = new Error('empty chat request');
      error.code = 'EMPTY_REQUEST';
      throw error;
    }
    const answer = `收到：${userText}。我会继续陪你专注和休息。`;
    for (const chunk of splitToChunks(answer, 7)) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      yield chunk;
    }
  }
}
