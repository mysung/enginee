import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { saveContentToHtml } from './server/contentSaver';
import { generateChatReply } from './server/geminiService';
import { loadVisitorData, recordVisit, addVisitorCheer } from './server/visitorService';

function backendApiPlugin(): Plugin {
  return {
    name: 'backend-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/visitors' && req.method === 'GET') {
          try {
            const data = loadVisitorData();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || '방문자 정보 조회 실패' }));
          }
        } else if (req.url === '/api/visitors/hit' && req.method === 'POST') {
          try {
            const ua = req.headers['user-agent'] as string | undefined;
            const data = recordVisit(ua);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || '방문 기록 실패' }));
          }
        } else if (req.url === '/api/visitors/log' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const ua = req.headers['user-agent'] as string | undefined;
              const data = addVisitorCheer({
                name: parsed.name,
                message: parsed.message,
                emoji: parsed.emoji,
                userAgent: ua,
              });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, data }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || '응원 기록 실패' }));
            }
          });
        } else if (req.url === '/api/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { message, history, context } = data;
              if (!message || typeof message !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: '메시지를 입력해주세요.' }));
                return;
              }
              const reply = await generateChatReply(message, history, context);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, reply }));
            } catch (err: any) {
              console.error('Chat error in vite middleware:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: err.message || 'Gemini API 호출 중 오류가 발생했습니다.',
                })
              );
            }
          });
        } else if (req.url === '/api/save-content' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = saveContentToHtml(data);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Save error in vite middleware:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || '저장 중 오류가 발생했습니다.' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
