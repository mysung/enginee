import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateChatReply } from "./server/geminiService";
import { saveContentToHtml } from "./server/contentSaver";
import { loadVisitorData, recordVisit, addVisitorCheer } from "./server/visitorService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Visitor stats & logs API
  app.get("/api/visitors", (req, res) => {
    try {
      const data = loadVisitorData();
      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Get visitors error:", err);
      return res.status(500).json({ error: "방문자 통계를 불러오지 못했습니다." });
    }
  });

  app.post("/api/visitors/hit", (req, res) => {
    try {
      const ua = req.headers["user-agent"] as string | undefined;
      const data = recordVisit(ua);
      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Record visit error:", err);
      return res.status(500).json({ error: "방문 기록 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/visitors/log", (req, res) => {
    try {
      const { name, message, emoji } = req.body || {};
      const ua = req.headers["user-agent"] as string | undefined;
      const data = addVisitorCheer({ name, message, emoji, userAgent: ua });
      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Visitor cheer error:", err);
      return res.status(500).json({ error: "발자국 기록 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "메시지를 입력해주세요." });
      }
      const reply = await generateChatReply(message, history, context);
      return res.json({ success: true, reply });
    } catch (err: any) {
      console.error("Chat error:", err);
      return res.status(500).json({
        error: err.message || "Gemini API 호출 중 오류가 발생했습니다.",
      });
    }
  });

  app.post("/api/save-content", (req, res) => {
    try {
      const result = saveContentToHtml(req.body);
      return res.json(result);
    } catch (err: any) {
      console.error("Save error:", err);
      return res.status(500).json({ error: err.message || "저장 중 오류가 발생했습니다." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
