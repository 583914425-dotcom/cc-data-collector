import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { spawn } from "child_process";

dotenv.config();

function extractJSON(text: string): string {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  let endChar = '';
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    endChar = ']';
  }
  
  if (start === -1) return text;
  
  const lastEnd = text.lastIndexOf(endChar);
  if (lastEnd !== -1 && lastEnd > start) {
    return text.substring(start, lastEnd + 1);
  }
  
  return text.substring(start);
}

function tryFixTruncatedJSON(jsonStr: string): string {
  let stack: string[] = [];
  let inString = false;
  let escaped = false;
  let fixedStr = '';
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (inString) {
      if (char === '\n') {
        fixedStr += '\\n';
        continue;
      } else if (char === '\r') {
        fixedStr += '\\r';
        continue;
      } else if (char === '\t') {
        fixedStr += '\\t';
        continue;
      }
      
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
    fixedStr += char;
  }
  
  let result = fixedStr;
  
  // Handle trailing backslash or incomplete unicode escape
  if (inString) {
    if (escaped) {
      // Remove trailing backslash
      result = result.slice(0, -1);
    } else {
      // Check for incomplete unicode escape e.g. \u12
      const lastBackslash = result.lastIndexOf('\\');
      if (lastBackslash !== -1) {
        const afterBackslash = result.slice(lastBackslash + 1);
        if (afterBackslash.startsWith('u') && afterBackslash.length < 5) {
          // Remove incomplete unicode escape
          result = result.slice(0, lastBackslash);
        }
      }
    }
    result += '"';
  }
  
  // Remove trailing comma if it exists
  result = result.trim().replace(/,\s*$/, '');
  
  // If it ends with a colon, add a null value
  if (result.endsWith(':')) {
    result += ' null';
  }
  
  while (stack.length > 0) {
    result += stack.pop();
  }
  return result;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });
  const PORT = 5000;

  // Track online users
  const onlineUsers = new Map<string, string>(); // socketId -> username

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("user:join", (username: string) => {
      console.log("User joined:", username, socket.id);
      onlineUsers.set(socket.id, username);
      const usersList = Array.from(onlineUsers.values());
      console.log("Broadcasting online users:", usersList);
      io.emit("users:online", usersList);
    });

    socket.on("chat:message", ({ to, message, from, image }) => {
      if (to === 'all') {
        io.emit("chat:message", { from, message, to: 'all', image });
      } else {
        // Find socket ID for recipient
        let recipientSocketId = "";
        for (const [id, username] of onlineUsers.entries()) {
          if (username === to) {
            recipientSocketId = id;
            break;
          }
        }
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("chat:message", { from, message, to, image });
        }
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      io.emit("users:online", Array.from(onlineUsers.values()));
    });
  });

  // Increase payload limit for large base64 files
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/test-key", async (req, res) => {
    try {
      const { geminiApiKey } = req.body;
      if (!geminiApiKey) {
        return res.status(400).json({ error: "API Key is required" });
      }
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Hello",
      });
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("API Key test failed:", error);
      res.status(500).json({ error: error.message || "API Key test failed" });
    }
  });

  app.post("/api/extract", async (req, res) => {
    try {
      const { contents, promptText, deepseekApiKey, geminiApiKey, isBatch, isFeedback } = req.body;

      let schema;
      const properties = {
        customPatientId: { type: "string", description: "患者ID (用户自定义，AI默认留空返回 \"\")" },
        name: { type: "string", description: "姓名" },
        phone: { type: "string", description: "电话号码" },
        age: { type: "number", description: "年龄" },
        gender: { type: "string", description: "性别 (男/女)" },
        menstrualStatus: { type: "string", description: "月经状态 (未绝经/围绝经/绝经/未知)" },
        abortionHistory: { type: "string", description: "流产史 (是/否/未知)" },
        hpvInfection: { type: "string", description: "HPV感染 (阳性/阴性/未知)" },
        height: { type: "number", description: "身高 (cm)" },
        weight: { type: "number", description: "体重 (kg)" },
        systolicBP: { type: "number", description: "收缩压 (mmHg)" },
        diastolicBP: { type: "number", description: "舒张压 (mmHg)" },
        figo2018: { type: "string", description: "FIGO 2018分期" },
        tnmStaging: { type: "string", description: "TNM分期" },
        histologyType: { type: "string", description: "组织学类型 (鳞状细胞癌/腺癌/腺鳞癌/其他)" },
        differentiation: { type: "string", description: "肿瘤分化程度 (高分化/中分化/低分化/未知)" },
        tumorMaxDiameter: { type: "number", description: "肿瘤最大径 (cm)" },
        parametrialInvasion: { type: "string", description: "宫旁浸润 (有/无/未知)" },
        corpusInvasion: { type: "string", description: "宫体浸润 (有/无/未知)" },
        vaginalInvasion: { type: "string", description: "阴道受侵范围 (无/上1/3/中1/3/下1/3/未知)" },
        bladderInvasion: { type: "string", description: "膀胱受侵 (有/无/未知)" },
        rectalInvasion: { type: "string", description: "直肠受侵 (有/无/未知)" },
        pelvicLN: { type: "string", description: "盆腔淋巴结转移 (有/无/未知)" },
        rbcCount: { type: "number", description: "红细胞计数" },
        wbcCount: { type: "number", description: "白细胞计数" },
        plateletCount: { type: "number", description: "血小板计数" },
        lymphocyteCount: { type: "number", description: "淋巴细胞计数" },
        neutrophilCount: { type: "number", description: "中性粒细胞计数" },
        monocyteCount: { type: "number", description: "单核细胞计数" },
        preTreatmentHb: { type: "number", description: "治疗前血红蛋白" },
        scca: { type: "number", description: "SCCA" },
        rtTechnology: { type: "string", description: "放疗技术 (VMAT/IMRT/2D/3D-CRT/其他)" },
        ebrtDose: { type: "number", description: "外照射总剂量EBRT (Gy)" },
        icbtDose: { type: "number", description: "内照射总剂量ICBT (Gy)" },
        icbtFractions: { type: "number", description: "内照射次数" },
        ccrtDuration: { type: "number", description: "同步放化疗疗程 (天)" },
        platinumRegimen: { type: "string", description: "含铂化疗方案" },
        platinumDrug: { type: "string", description: "含铂药物 (顺铂/卡铂/洛铂/其他)" },
        cisplatinWeekly: { type: "string", description: "同步顺铂周疗 (是/否)" },
        chemoCycles: { type: "number", description: "同步化疗次数" },
        totalChemoDose: { type: "number", description: "化疗总剂量 (mg)" },
        description: { type: "string", description: "影像描述" },
        diagnosis: { type: "string", description: "影像诊断" },
        treatmentResponse: { type: "string", description: "放化疗疗效 (CR/PR/SD/PD/未知)" },
        recurrence: { type: "string", description: "复发 (有/无/未知)" },
        recurrenceSite: { type: "string", description: "复发部位" },
        pfsMonths: { type: "number", description: "无进展生存期 (月)" },
        osMonths: { type: "number", description: "总生存期 (月)" },
        survivalStatus: { type: "string", description: "生存状态 (存活/死亡/失访)" },
        followUpDate: { type: "string", description: "随访时间" }
      };

      if (isBatch) {
        schema = {
          type: "array",
          items: {
            type: "object",
            properties: properties
          }
        };
      } else {
        schema = {
          type: "object",
          properties: properties
        };
      }

      if (deepseekApiKey) {
        // Use DeepSeek API
        const openai = new OpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: deepseekApiKey
        });

        // Convert contents to a single text string for DeepSeek
        let fullText = "";
        for (const item of contents) {
          if (item.text) {
            fullText += item.text + "\n";
          } else if (item.inlineData) {
            // DeepSeek doesn't support PDF/images natively in standard chat.
            // The frontend should have extracted text from PDF if DeepSeek is used.
            console.warn("DeepSeek API does not support inlineData. Skipping.");
          }
        }

        const response = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: `你是一个专业的医疗数据提取助手。
            请从提供的病历资料中提取结构化数据。
            
            【重要规则】
            1. 缺失值处理：若原文中没有明确提及某项内容，数值型字段返回 null，字符型字段返回 ""。
            2. 优先级处理：
               - 身高、体重、血压：护理评估单 > 病案首页 > Excel > 其他。
               - 电话号码：优先提取病案首页“现住址/电话”栏中的患者本人电话。
               - 组织学类型、分化程度：优先从病理诊断或出院记录中的外院病理描述提取。
               - 影像描述、影像诊断：优先从 Excel 对应列中直接读取原文。如果 Excel 为空，再从病历中生成。
               - 实验室指标：Excel 明确值 > 检验报告单 > 其他。
            3. 字段逻辑：
               - customPatientId：这是用户自定义字段，AI 默认留空（返回 ""）。
               - 放疗技术：提取技术名称（如 VMAT、IMRT），不要提取治疗目的。
               - 内照射：次数和总剂量必须分开。若只写“4次”，则 icbtFractions=4, icbtDose=null。
               - 宫体浸润：若影像提到“累及肌层”等，应提取为“有”。
               - 宫旁浸润：右宫旁(+)或“侵及宫旁”应提取为“有”。
            4. 自动计算字段：不要提取任何自动计算字段（如 BMI, NLR, PLR, LMR, EQD2, EQD4 等），这些由系统处理。
            5. 简洁性：精简 'description' 和 'diagnosis' 字段，仅保留核心医学发现，避免冗长描述，以防输出截断。
            6. 格式：严格返回 JSON 格式。
            
            你是一个专业的医疗数据提取助手。请根据提供的【原始病历内容】，按照指定的 JSON 结构提取数据。
            
            The extracted JSON MUST strictly follow this schema:
            ${JSON.stringify(schema, null, 2)}
            
            Ensure the keys exactly match the properties defined in the schema.` },
            { role: "user", content: promptText + "\n\n" + fullText }
          ],
          response_format: { type: "json_object" },
          max_tokens: 8192,
          temperature: 0.1
        });

        const choice = response.choices[0];
        const content = choice.message.content;
        if (!content) throw new Error("No content returned from DeepSeek");
        
        if ((choice.finish_reason as string) === 'length') {
          throw new Error("AI 返回内容过长被截断，请尝试减少上传的文件数量或分次提取。");
        }
        
        let jsonStr = extractJSON(content.trim());
        
        try {
          const parsed = JSON.parse(jsonStr);
          if (Object.keys(parsed).length === 0) {
            throw new Error("AI 返回内容为空，未提取到有效数据。");
          }
          if (isBatch && !Array.isArray(parsed) && parsed.patients) {
              res.json(parsed.patients);
          } else {
              res.json(parsed);
          }
        } catch (parseError: any) {
          console.error("DeepSeek JSON Parse Error. Attempting fix. Raw content snippet:", jsonStr.substring(0, 500) + "...");
          try {
            const fixedJson = tryFixTruncatedJSON(jsonStr);
            const parsed = JSON.parse(fixedJson);
            if (Object.keys(parsed).length === 0) {
              throw new Error("AI 返回内容过长被截断，未提取到有效数据。请尝试减少上传的文件数量。");
            }
            if (isBatch && !Array.isArray(parsed) && parsed.patients) {
                res.json(parsed.patients);
            } else {
                res.json(parsed);
            }
          } catch (fixError: any) {
            if ((choice.finish_reason as string) === 'length') {
              throw new Error("AI 返回内容过长被截断，且无法自动修复 JSON。请尝试减少上传的文件数量或分次提取。");
            }
            throw new Error(`解析 DeepSeek 返回的 JSON 失败: ${parseError.message}`);
          }
        }
      } else {
        // Use Gemini API (Server-side proxy)
        const isUserKey = !!geminiApiKey;
        const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
          throw new Error("内置的 Gemini API Key 未配置。请点击右上角【设置】，填入您自己的 Gemini API Key。");
        }
        
        console.log(`Using ${isUserKey ? 'user-provided' : 'environment'} Gemini API key. (Key starts with: ${apiKey.substring(0, 4)}...)`);
        const ai = new GoogleGenAI({ apiKey });
        
        // Convert string types to Gemini Type enum
        const geminiProperties: any = {};
        for (const [key, value] of Object.entries(properties)) {
          geminiProperties[key] = {
            type: value.type === "number" ? Type.NUMBER : Type.STRING,
            description: value.description
          };
        }

        let geminiSchema;
        if (isBatch) {
          geminiSchema = {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: geminiProperties
            }
          };
        } else {
          geminiSchema = {
            type: Type.OBJECT,
            properties: geminiProperties
          };
        }

        try {
          const geminiContents = {
            parts: [
              { text: promptText },
              ...contents
            ]
          };

          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: geminiContents,
            config: {
              systemInstruction: `你是一个专业的医疗数据提取助手。
              请从提供的资料中提取结构化数据。
              
              【重要规则】
              1. 缺失值处理：若原文中没有明确提及某项内容，数值型字段返回 null，字符型字段返回 ""。
              2. 优先级处理：
                 - 身高、体重、血压：护理评估单 > 病案首页 > Excel > 其他。
                 - 电话号码：优先提取病案首页“现住址/电话”栏中的患者本人电话。
                 - 组织学类型、分化程度：优先从病理诊断或出院记录中的外院病理描述提取。
                 - 影像描述、影像诊断：优先从 Excel 对应列中直接读取原文。如果 Excel 为空，再从病历中生成。
                 - 实验室指标：Excel 明确值 > 检验报告单 > 其他。
              3. 字段逻辑：
                 - customPatientId：这是用户自定义字段，AI 默认留空（返回 ""）。
                 - 放疗技术：提取技术名称（如 VMAT、IMRT），不要提取治疗目的。
                 - 内照射：次数和总剂量必须分开。若只写“4次”，则 icbtFractions=4, icbtDose=null。
                 - 宫体浸润：若影像提到“累及肌层”等，应提取为“有”。
                 - 宫旁浸润：右宫旁(+)或“侵及宫旁”应提取为“有”。
              4. 自动计算字段：不要提取任何自动计算字段（如 BMI, NLR, PLR, LMR, EQD2, EQD4 等），这些由系统处理。
              5. 简洁性：精简 'description' 和 'diagnosis' 字段，仅保留核心医学发现，避免冗长描述，以防输出截断。
              
              你是一个专业的医疗数据提取助手。请根据提供的【原始病历内容】，按照指定的 JSON 结构提取数据。`,
              responseMimeType: "application/json",
              responseSchema: geminiSchema,
              maxOutputTokens: 16384, // Increase output token limit
              temperature: 0.1, // Lower temperature for more stable JSON
            }
          });

          let text = response.text;
          if (!text) throw new Error("No text returned from Gemini");
          
          text = extractJSON(text.trim());

          try {
            const parsed = JSON.parse(text);
            if (Object.keys(parsed).length === 0) {
              throw new Error("AI 返回内容为空，未提取到有效数据。");
            }
            res.json(parsed);
          } catch (parseError: any) {
            console.error("JSON Parse Error. Attempting fix. Raw text snippet:", text.substring(0, 500) + "...");
            
            try {
              const fixedJson = tryFixTruncatedJSON(text);
              const parsed = JSON.parse(fixedJson);
              if (Object.keys(parsed).length === 0) {
                throw new Error("AI 返回内容过长被截断，未提取到有效数据。请尝试减少上传的文件数量。");
              }
              res.json(parsed);
              return;
            } catch (fixError: any) {
              const candidate = response.candidates?.[0];
              if (candidate?.finishReason === 'MAX_TOKENS') {
                throw new Error(fixError.message || "AI 返回内容过长被截断，且无法自动修复 JSON。请尝试减少上传的文件数量或分次提取。");
              }
              throw new Error(`解析 AI 返回的 JSON 失败: ${parseError.message}`);
            }
          }
        } catch (error: any) {
          console.error(`Gemini API call failed using ${isUserKey ? 'user-provided' : 'environment'} key.`, error);
          
          let errorMessage = error.message || "Unknown error";
          if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
            if (!isUserKey) {
              throw new Error("内置的 Gemini API Key 无效或未配置。请点击右上角【设置】，填入您自己的 Gemini API Key。");
            } else {
              throw new Error("您填写的 Gemini API Key 无效，请检查是否填写正确。");
            }
          }
          
          throw new Error(`Gemini API call failed using ${isUserKey ? 'user-provided' : 'environment'} key. Error: ${errorMessage}`);
        }
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: error.message || "Extraction failed" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, fullText, currentData, geminiApiKey, deepseekApiKey } = req.body;

      if (deepseekApiKey) {
        const openai = new OpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: deepseekApiKey
        });

        const response = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: `你是一个医疗数据提取专家。用户会问你关于从病历中提取数据的逻辑或准确性问题。
            你需要根据提供的【原始病历内容】和【当前表单数据】，解释你选择某个值的理由。
            
            【回复原则】
            1. 诚实：如果数据确实模糊，请说明模糊之处。
            2. 逻辑清晰：引用原文中的具体段落或数值。
            3. 优先级说明：如果多个文件有冲突，说明你遵循的优先级（如：护理评估单 > 病案首页）。
            4. 简洁：直接回答问题，不要过多的客套话。` },
            { role: "user", content: `原始病历内容：\n${fullText}\n\n当前表单数据：\n${JSON.stringify(currentData, null, 2)}\n\n用户问题：${message}` }
          ],
          temperature: 0.3
        });

        res.json({ text: response.choices[0].message.content });
      } else {
        const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key not configured");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `你是一个医疗数据提取专家。用户会问你关于从病历中提取数据的逻辑或准确性问题。
          你需要根据提供的【原始病历内容】和【当前表单数据】，解释你选择某个值的理由。
          
          原始病历内容：\n${fullText}\n\n当前表单数据：\n${JSON.stringify(currentData, null, 2)}\n\n用户问题：${message}
          
          【回复原则】
          1. 诚实：如果数据确实模糊，请说明模糊之处。
          2. 逻辑清晰：引用原文中的具体段落或数值。
          3. 优先级说明：如果多个文件有冲突，说明你遵循的优先级（如：护理评估单 > 病案首页）。
          4. 简洁：直接回答问题，不要过多的客套话。`,
          config: {
            temperature: 0.3,
            maxOutputTokens: 2048
          }
        });

        res.json({ text: response.text });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Chat failed" });
    }
  });

  // ── PocketBase proxy ────────────────────────────────────────────────────────
  // Allow CORS for cross-origin requests (e.g. browser served on port 443 CDN,
  // hitting our Express on port 5000).
  app.use('/pb-api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.use(
    '/pb-api',
    createProxyMiddleware({
      target: 'http://localhost:8090',
      changeOrigin: true,
      pathRewrite: { '^/pb-api': '' },
      on: {
        // Re-stream the body after express.json() has consumed it
        proxyReq: fixRequestBody,
        error: (_err, _req, res: any) => {
          res.status(502).json({ error: 'PocketBase not reachable' });
        },
      },
    })
  );

  // ── Spawn PocketBase in production ─────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    const pbBinary = path.resolve('./bin/pocketbase');
    if (fs.existsSync(pbBinary)) {
      const pb = spawn(pbBinary, ['serve', '--http=0.0.0.0:8090', '--dir=./pb_data'], {
        stdio: 'inherit',
        detached: false,
      });
      pb.on('error', (err) => console.error('PocketBase spawn error:', err));
      process.on('exit', () => pb.kill());
    } else {
      console.warn('PocketBase binary not found at', pbBinary);
    }
  }

  // Vite middleware for development or serve static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist/public');
    console.log('Serving static files from:', distPath);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
