import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

// Gemini AI client initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API endpoint to parse academic calendar using Gemini AI
app.post("/api/parse-calendar", upload.single("file"), async (req, res) => {
  try {
    let fileBuffer: Buffer | undefined = req.file?.buffer;
    let mimeType: string = req.file?.mimetype || "image/png";

    // Fallback if sent as base64 in JSON body
    if (!fileBuffer && req.body.fileData) {
      const base64Str = req.body.fileData.replace(/^data:[^;]+;base64,/, "");
      fileBuffer = Buffer.from(base64Str, "base64");
      mimeType = req.body.mimeType || "image/png";
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: "학사력 파일이 업로드되지 않았습니다." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API 키가 설정되지 않았습니다. 왼쪽 상단 메뉴 또는 Settings에서 API 키를 확인해주세요." });
    }

    const base64Data = fileBuffer.toString("base64");

    const prompt = `
    당신은 학교 학사력 분석 전문가입니다. 첨부된 학사력 이미지(또는 문서)에서 2026년(또는 해당 연도)의 모든 학사 일정(행사, 시험, 휴일, 방학, 개학, 입학, 축제, 상담 등)을 빠짐없이 정확하게 추출해주세요.
    
    각 일정에 대해 다음 정보를 포함하는 JSON 배열로 응답해주세요:
    1. title: 일정 제목 (예: "입학식, 개학식", "정기시험 1차", "여름방학 선언일", "개교기념일" 등)
    2. startDate: 시작 날짜 (YYYY-MM-DD 형식, 연도가 명시되지 않았다면 2026년 기준)
    3. endDate: 종료 날짜 (YYYY-MM-DD 형식, 단일 날짜인 경우 startDate와 동일)
    4. category: 분류 (예: "행사", "시험", "방학/휴일", "기타")
    5. description: 상세 설명 (학년 또는 시간 등 추가 정보가 있다면 포함)

    오류 없이 모든 날짜와 일정을 정확하게 파싱하여 올바른 JSON 형식으로만 반환해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // Using gemini-3.1-flash-lite as requested for fast, accurate multimodal parsing
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "일정 제목" },
              startDate: { type: Type.STRING, description: "시작 날짜 (YYYY-MM-DD)" },
              endDate: { type: Type.STRING, description: "종료 날짜 (YYYY-MM-DD)" },
              category: { type: Type.STRING, description: "일정 분류 (행사, 시험, 방학/휴일, 기타)" },
              description: { type: Type.STRING, description: "상세 설명" },
            },
            required: ["title", "startDate", "endDate", "category"],
          },
        },
      },
    });

    const jsonText = response.text || "[]";
    const events = JSON.parse(jsonText);

    return res.json({ success: true, events });
  } catch (error: any) {
    console.error("Calendar parsing error:", error);
    return res.status(500).json({ error: error.message || "학사력 파싱 중 오류가 발생했습니다." });
  }
});

async function startServer() {
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
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
