import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function generateChatReply(
  message: string,
  history: Array<{ role: string; text: string }> = [],
  context: Record<string, any> = {}
): Promise<string> {
  const ai = getGeminiClient();

  const authorName = context.authorName || '엔지니';
  const role = context.role || 'AI 기술을 활용해 유용한 도구를 만드는 크리에이터';
  const bio = context.bio || '';
  const skills = Array.isArray(context.skills) ? context.skills.join(', ') : (context.skills || '');
  const webapps = Array.isArray(context.webapps)
    ? context.webapps.map((w: any) => `${w.title || w.name || ''} (${w.description || ''})`).join('; ')
    : (context.webapps || '오늘 뭐 먹지? v3');
  const careers = Array.isArray(context.careers)
    ? context.careers.map((c: any) => `${c.title || ''} (${c.company || ''}, ${c.period || ''})`).join('; ')
    : '';

  const systemInstruction = `당신은 ${authorName} 님의 개인 미니 홈페이지에서 방문객과 소통하는 똑똑하고 친절한 AI 어시스턴트(Google Gemini 기반)입니다.

[홈페이지 주인 정보]
- 이름: ${authorName}
- 직책/역할: ${role}
- 소개: ${bio}
- 보유 스킬/기술 스택: ${skills}
- 주요 경력: ${careers}
- 대표 웹앱 프로젝트: ${webapps}

[답변 원칙]
1. 정중하고 친절하며 전문적이면서도 따뜻한 어조로 대화하세요.
2. ${authorName} 님의 프로필, 포트폴리오, 경력, 기술 스택, 웹앱에 대한 질문이 들어오면 위 정보를 기반으로 자연스럽고 상세하게 설명해주세요.
3. 방문객이 "오늘 뭐 먹지?" 등 프로젝트나 웹앱을 물어보면, Google AI Studio로 제작되어 Cloudflare Pages(eatzy.pages.dev)에 배포된 음식 추천 웹앱이며, 상단 미니 웹앱 탭에서 실시간 룰렛과 음식 추천을 바로 체험해볼 수 있다고 안내해주세요.
4. 웹 개발, AI, 코딩, 일상 대화, 유용한 팁 등 어떠한 일반적인 질문이나 대화에도 막힘없이 유익하고 재치있게 답변해주세요.
5. Markdown 문법(굵은 글씨, 불릿 포인트 등)을 적절히 활용하여 읽기 편하게 작성하세요.`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const item of history.slice(-6)) {
      if (item && item.text) {
        contents.push({
          role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.text }],
        });
      }
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      // Try next available model without throwing or logging noisy error strings
    }
  }

  // Graceful fallback if all models are temporarily under high demand
  return `안녕하세요! ${authorName} 님의 AI 어시스턴트입니다. 현재 일시적인 AI 모델 접속량 급증(503)으로 실시간 서버 연결이 지연되고 있으나, 질문을 잘 확인했습니다.\n\n${authorName} 님의 프로필 및 **'오늘 뭐 먹지? v3'** 등 대표 프로젝트 정보는 상단 **[소개]** 탭 및 **[미니 웹앱]** 탭에서 언제든 바로 확인하고 체험하실 수 있습니다. 잠시 후 다시 질문해 주시면 더욱 상세히 안내해 드리겠습니다! 😊`;
}
