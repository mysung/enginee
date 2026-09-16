import fs from 'fs';
import path from 'path';

export interface VisitorLog {
  id: string;
  visitorNo: number;
  name: string;
  action: string;
  message?: string;
  emoji?: string;
  device: string;
  timestamp: number;
}

export interface VisitorData {
  total: number;
  today: number;
  lastDate: string;
  recentLogs: VisitorLog[];
}

const DATA_FILE = path.resolve(process.cwd(), 'server', 'visitors.json');

function getTodayString(): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replace(/\. /g, '-')
      .replace('.', '')
      .trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getDefaultData(): VisitorData {
  const now = Date.now();
  return {
    total: 1286,
    today: 24,
    lastDate: getTodayString(),
    recentLogs: [
      {
        id: 'log-seed-1',
        visitorNo: 1286,
        name: '방문자',
        action: '홈페이지 방문',
        message: '미니 웹앱 갤러리 잘 둘러보고 갑니다! ✨',
        emoji: '✨',
        device: 'macOS · Chrome',
        timestamp: now - 1000 * 60 * 3, // 3분 전
      },
      {
        id: 'log-seed-2',
        visitorNo: 1285,
        name: '동료 개발자',
        action: '응원 한마디',
        message: 'AI 비서 챗봇 응답이 빠르고 유용하네요 🚀',
        emoji: '🚀',
        device: 'Windows · Edge',
        timestamp: now - 1000 * 60 * 18, // 18분 전
      },
      {
        id: 'log-seed-3',
        visitorNo: 1284,
        name: '방문자',
        action: '홈페이지 방문',
        message: '오늘 뭐 먹지? 웹앱 플레이해봤습니다 🍱',
        emoji: '🍱',
        device: 'iOS · Safari',
        timestamp: now - 1000 * 60 * 45, // 45분 전
      },
      {
        id: 'log-seed-4',
        visitorNo: 1283,
        name: '익명의 방문자',
        action: '응원 한마디',
        message: '포트폴리오 디자인이 깔끔하고 멋집니다! 👍',
        emoji: '👍',
        device: 'Android · Chrome',
        timestamp: now - 1000 * 60 * 120, // 2시간 전
      },
    ],
  };
}

export function loadVisitorData(): VisitorData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const defaultData = getDefaultData();
      saveVisitorData(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.total !== 'number') {
      const defaultData = getDefaultData();
      saveVisitorData(defaultData);
      return defaultData;
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load visitor data, using default:', err);
    return getDefaultData();
  }
}

export function saveVisitorData(data: VisitorData): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save visitor data:', err);
  }
}

export function parseDeviceFromUA(ua?: string): string {
  if (!ua) return '웹 브라우저';
  const uaLower = ua.toLowerCase();
  let os = '기타 기기';
  let browser = '브라우저';

  if (uaLower.includes('iphone')) os = 'iPhone';
  else if (uaLower.includes('ipad')) os = 'iPad';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) os = 'macOS';
  else if (uaLower.includes('windows')) os = 'Windows';
  else if (uaLower.includes('linux')) os = 'Linux';

  if (uaLower.includes('edg/')) browser = 'Edge';
  else if (uaLower.includes('chrome/') && !uaLower.includes('edg/')) browser = 'Chrome';
  else if (uaLower.includes('safari/') && !uaLower.includes('chrome/')) browser = 'Safari';
  else if (uaLower.includes('firefox/')) browser = 'Firefox';

  return `${os} · ${browser}`;
}

export function recordVisit(userAgent?: string): VisitorData {
  const data = loadVisitorData();
  const todayStr = getTodayString();

  if (data.lastDate !== todayStr) {
    data.lastDate = todayStr;
    data.today = 1;
  } else {
    data.today += 1;
  }
  data.total += 1;

  const device = parseDeviceFromUA(userAgent);
  const newLog: VisitorLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    visitorNo: data.total,
    name: `방문자 #${data.total}`,
    action: '홈페이지 방문',
    device,
    timestamp: Date.now(),
  };

  data.recentLogs = [newLog, ...(data.recentLogs || [])].slice(0, 30);
  saveVisitorData(data);
  return data;
}

export function addVisitorCheer(entry: {
  name?: string;
  message?: string;
  emoji?: string;
  userAgent?: string;
}): VisitorData {
  const data = loadVisitorData();
  const device = parseDeviceFromUA(entry.userAgent);
  const cleanName = (entry.name || '').trim().slice(0, 20) || `방문자 #${data.total}`;
  const cleanMessage = (entry.message || '').trim().slice(0, 100);
  const cleanEmoji = entry.emoji || '💬';

  const newLog: VisitorLog = {
    id: `cheer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    visitorNo: data.total,
    name: cleanName,
    action: '응원 한마디',
    message: cleanMessage,
    emoji: cleanEmoji,
    device,
    timestamp: Date.now(),
  };

  data.recentLogs = [newLog, ...(data.recentLogs || [])].slice(0, 30);
  saveVisitorData(data);
  return data;
}
