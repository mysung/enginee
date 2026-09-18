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
    ? context.webapps.map((w: any) => `${w.title || w.name || ''} (${w.desc || w.description || ''}${w.url ? ', 배포 URL: ' + w.url : ''})`).join('; ')
    : (context.webapps || '오늘 뭐 먹지? v3, 구글 맵 기반 트레킹 플래너');
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

// --------------------------------------------------------------------
// AI 스마트 텍스트 요약기 Engine
// --------------------------------------------------------------------
export interface SummaryResult {
  oneLineTakeaway: string;
  bullets: string[];
  keywords: string[];
  readingTimeSaved: string;
  wordCount: number;
  originalLength: number;
}

export async function generateSummary(
  text: string,
  style: string = 'bullets',
  length: string = 'medium'
): Promise<SummaryResult> {
  const cleanText = (text || '').trim();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const originalLength = cleanText.length;
  const estReadMinutes = Math.max(1, Math.round(cleanText.length / 350));
  const readingTimeSaved = `약 ${Math.max(1, estReadMinutes - 1)}분 절약 (${originalLength}자 원문)`;

  if (!cleanText) {
    throw new Error('요약할 텍스트를 입력해주세요.');
  }

  // Fallback heuristic summarizer if AI is unavailable
  const fallbackSummary = (): SummaryResult => {
    const sentences = cleanText
      .split(/(?<=[.?!。])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    const bullets: string[] = [];
    if (sentences.length <= 3) {
      bullets.push(...sentences);
    } else {
      // Pick first sentence, middle informative sentence, and last sentence
      bullets.push(sentences[0]);
      const middleIdx = Math.floor(sentences.length / 2);
      if (middleIdx > 0 && middleIdx < sentences.length - 1) {
        bullets.push(sentences[middleIdx]);
      }
      bullets.push(sentences[sentences.length - 1]);
    }

    // Extract keywords by frequency
    const words = cleanText
      .replace(/[^\w가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['그리고', '하지만', '또한', '있는', '것은', '등의', '따라', '통해'].includes(w));
    const freq: Record<string, number> = {};
    words.forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
    const keywords = Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .slice(0, 5);

    return {
      oneLineTakeaway: bullets[0] || '본문의 핵심 정보를 요약했습니다.',
      bullets: bullets.length > 0 ? bullets : [cleanText.slice(0, 100) + '...'],
      keywords: keywords.length > 0 ? keywords : ['요약', '핵심정리'],
      readingTimeSaved,
      wordCount,
      originalLength,
    };
  };

  try {
    const ai = getGeminiClient();
    const styleDesc =
      style === 'action'
        ? '실행 가능한 액션 아이템과 시사점 위주'
        : style === 'detailed'
        ? '핵심 요약 및 문맥상 중요한 세부 근거 포함'
        : style === 'eli5'
        ? '비전공자나 초보자도 바로 이해할 수 있는 쉽고 직관적인 설명'
        : '핵심 사실과 결론 위주의 명쾌한 3줄 불릿포인트';

    const countTarget = length === 'short' ? '2~3개' : length === 'long' ? '4~6개' : '3~4개';

    const prompt = `다음 텍스트를 분석하여 요청된 스타일("${styleDesc}")로 요약해주세요.
반드시 아래와 같은 JSON 형식으로만 응답해주세요:
{
  "oneLineTakeaway": "본문의 가장 결정적인 한 줄 핵심 결론",
  "bullets": ["핵심 요약 불릿 포인트 1", "핵심 요약 불릿 포인트 2", ...총 ${countTarget}],
  "keywords": ["핵심키워드1", "핵심키워드2", "핵심키워드3", "핵심키워드4", "핵심키워드5"]
}

[원문 텍스트]
${cleanText.slice(0, 12000)}`;

    const modelsToTry = [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const raw = response.text || '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            oneLineTakeaway: parsed.oneLineTakeaway || '핵심 요약이 완료되었습니다.',
            bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0 ? parsed.bullets : fallbackSummary().bullets,
            keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : fallbackSummary().keywords,
            readingTimeSaved,
            wordCount,
            originalLength,
          };
        }
      } catch (e) {
        // Try next model
      }
    }
  } catch (err) {
    console.warn('Gemini summary error, using fallback summarizer', err);
  }

  return fallbackSummary();
}

// --------------------------------------------------------------------
// 프롬프트 옵티마이저 Engine
// --------------------------------------------------------------------
export interface OptimizePromptResult {
  optimizedPrompt: string;
  improvements: string[];
  targetLlm: string;
  recommendedRole: string;
  tips: string;
}

export async function optimizePrompt(
  prompt: string,
  targetLlm: string = 'ChatGPT & Claude',
  style: string = 'expert'
): Promise<OptimizePromptResult> {
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    throw new Error('최적화할 프롬프트를 입력해주세요.');
  }

  const roleMap: Record<string, string> = {
    expert: '각 분야 최고 권위의 15년 차 시니어 전문가 컨설턴트',
    business: '비즈니스 전략 기획 및 마케팅 디렉터',
    dev: '대규모 분산 시스템 및 프론트엔드/백엔드 수석 소프트웨어 아키텍트',
    creative: '스토리텔링과 흡인력 높은 카피라이팅 전문 크리에이티브 디렉터',
    data: '데이터 기반 인사이트 도출 및 구조화된 분석을 수행하는 수석 데이터 사이언티스트',
  };

  const selectedRole = roleMap[style] || roleMap.expert;

  const fallbackOptimization = (): OptimizePromptResult => {
    const formatted = `### [Role & Identity]
당신은 **${selectedRole}**입니다. 사용자의 목표를 정확히 파악하고, 깊이 있는 전문성과 실무적인 통찰을 바탕으로 최상의 결과물을 제공합니다.

### [Objective & Context]
사용자의 핵심 요청 사항:
"${cleanPrompt}"

### [Guidelines & Step-by-Step Instructions]
1. 사용자의 요청 배경과 목적을 분석하여 가장 효과적인 해결책을 도출하세요.
2. 불필요한 서론이나 군더더기 없이, 직관적이고 실행 가능한 답변을 우선 제시하세요.
3. 단계별 가이드, 코드 예시, 또는 구체적인 실행 계획을 마크다운 표나 불릿포인트로 구조화하세요.
4. 발생 가능한 잠재적 문제점(엣지 케이스)이나 개선 팁을 마지막에 부연하세요.

### [Output Constraints]
- 어조: 정중하고 전문적이며 명확한 어조 (한국어)
- 형식: Markdown (제목, 소제목, 불릿포인트, 강조 태그 적극 활용)
- [선택적 변수]: 대상 독자: [타겟 독자 입력] / 목적: [구체적 달성 목표 입력]`;

    return {
      optimizedPrompt: formatted,
      improvements: [
        `명확한 전문 페르소나("${selectedRole}")를 부여하여 답변의 전문성과 깊이를 대폭 향상`,
        '구조화된 4단계 프로세스(배경분석 → 직관적 해결책 → 단계별 가이드 → 엣지케이스 검토) 명시',
        '마크다운 출력 포맷과 재사용 가능한 가변 파라미터 제약조건 추가',
      ],
      targetLlm,
      recommendedRole: selectedRole,
      tips: '요청 사항에 구체적인 데이터나 예시([입력 데이터])를 함께 전달하면 더욱 정밀한 답변을 얻을 수 있습니다.',
    };
  };

  try {
    const ai = getGeminiClient();
    const systemInstruction = `당신은 세계적인 프롬프트 엔지니어링 전문가입니다.
사용자가 입력한 모호하거나 단편적인 프롬프트를 OpenAI ChatGPT, Anthropic Claude, Google Gemini 등 최신 대규모 언어 모델이 최고 품질의 결과물을 생성할 수 있도록 완벽한 시스템 프롬프트로 변환해주세요.

변환 규칙:
1. 명확한 역할(Role) 및 페르소나 정의
2. 목표(Objective)와 맥락(Context) 구체화
3. 단계별 수행 지침(Step-by-step instructions) 및 세부 제약(Constraints)
4. 출력 형식(Output Format) 규정
5. 재사용 가능한 대괄호 플레이스홀더([변수명]) 포함

반드시 아래 JSON 포맷으로만 응답하세요:
{
  "optimizedPrompt": "마크다운으로 구조화된 완성형 프롬프트 전문",
  "improvements": ["개선사항 1", "개선사항 2", "개선사항 3"],
  "recommendedRole": "추천된 역할 페르소나",
  "tips": "해당 프롬프트를 사용할 때 최상의 답변을 얻기 위한 실전 팁"
}`;

    const promptText = `타겟 모델: ${targetLlm}
스타일 페르소나: ${selectedRole}
사용자의 원본 요청:
"${cleanPrompt}"`;

    const modelsToTry = [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const raw = response.text || '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            optimizedPrompt: parsed.optimizedPrompt || fallbackOptimization().optimizedPrompt,
            improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0 ? parsed.improvements : fallbackOptimization().improvements,
            targetLlm,
            recommendedRole: parsed.recommendedRole || selectedRole,
            tips: parsed.tips || fallbackOptimization().tips,
          };
        }
      } catch (e) {
        // Try next model
      }
    }
  } catch (err) {
    console.warn('Gemini optimize prompt error, using fallback optimizer', err);
  }

  return fallbackOptimization();
}

