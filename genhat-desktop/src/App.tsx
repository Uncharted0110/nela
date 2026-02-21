import { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

type ChatMode = "text" | "vision" | "audio" | "rag";

interface ModelFile {
  name: string;
  path: string;
}

interface RegisteredModel {
  id: string;
  name: string;
  tasks: string[];
}

interface IngestionStatus {
  doc_id: number;
  title: string;
  total_chunks: number;
  embedded_chunks: number;
  enriched_chunks: number;
  phase: string;
}

interface SourceChunk {
  chunk_id: number;
  doc_title: string;
  text: string;
  score: number;
}

interface RagResult {
  answer: string;
  sources: SourceChunk[];
}

interface RagStreamSetup {
  sources: SourceChunk[];
  prompt: string;
  llama_port: number;
  no_retrieval: boolean;
}

function App() {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  
  const [audioModels, setAudioModels] = useState<ModelFile[]>([]);
  const [selectedAudioModel, setSelectedAudioModel] = useState<string>("None");
  const [audioOutput, setAudioOutput] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshModels();
  }, []);

  const refreshModels = () => {
    Api.listModels()
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !selectedModel) {
          setSelectedModel(list[0].path);
        }
      })
      .catch(console.error);

    Api.listAudioModels()
      .then((list) => {
        setAudioModels(list);
      })
      .catch(console.error);
  };

  const handleModelChange = async (path: string) => {
    try {
      setSelectedModel(path);
      await Api.switchModel(path);
      setMessages([]); 
      // alert(`Switched to model: ${path.split("/").pop()}`); // Removed explicit alert for smoother UX
    } catch (err) {
      console.error(err);
      alert("Failed to switch model");
    }
  };

  const handleAddModel = () => {
    alert("To add a model, place the .gguf file into the 'models' folder of the application and restart/refresh.");
    // Future: Implement file picker + copy logic here
  };

  const handleSend = async (text: string) => {
    const newMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);
    setStreamingContent("");
    setAudioOutput("");
    setLoading(true);

    try {
      // RAG Mode — streaming: retrieve first, then SSE stream the answer
      if (chatMode === "rag") {
        try {
          // Phase 1: Retrieval (sources come back immediately)
          const setup = await invoke<RagStreamSetup>("query_rag_stream", { query: prompt });

          // Show sources immediately
          setRagResult({ answer: "", sources: setup.sources });

          // Handle empty results
          if (!setup.prompt) {
            const msg = setup.sources.length === 0
              ? "No relevant documents found. Please ingest some documents first."
              : "";
            setResponse(msg);
            setLoading(false);
            return;
          }

          // Phase 2: Stream the answer from llama-server SSE
          const res = await fetch(`http://127.0.0.1:${setup.llama_port}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: setup.prompt },
              ],
              stream: true,
            }),
          });

          if (!res.body) throw new Error("No response body");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullAnswer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.replace("data:", "").trim();
              if (payload === "[DONE]") {
                setRagResult(prev => prev ? { ...prev, answer: fullAnswer } : null);
                setLoading(false);
                return;
              }
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta;
                if (delta && delta.content) {
                  fullAnswer += delta.content;
                  setResponse(prev => prev + delta.content);
                }
              } catch {
                // ignore parse errors
              }
            }
          }

          setRagResult(prev => prev ? { ...prev, answer: fullAnswer } : null);
        } catch (e) {
          console.error(e);
          setResponse(`RAG query error: ${e}`);
        }
        setLoading(false);
        return;
      }

      // Audio Mode
      if (chatMode === "audio" && selectedAudioModel) {
         try {
           const path = await invoke<string>("generate_speech", {
             modelPath: selectedAudioModel,
             input: prompt,
           });
           setAudioOutput(convertFileSrc(path));
         } catch (e) {
           console.error(e);
           setResponse(`Error generating audio: ${e}`);
         }
         setLoading(false);
         return;
      }
      return;
    }

    // Normal Text Chat
    let fullResponse = "";
    Api.streamChat(
      [...messages, newMsg],
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
        fullResponse += chunk;
      },
      () => {
        setLoading(false);
        if (fullResponse) {
          setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
          setStreamingContent("");
        }
      },
      (err) => {
        console.error("Stream error", err);
        setLoading(false);
      }
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar simplified or removed in favor of top bar? User asked for selection in chat bar. 
          We keep sidebar for Chat History potentially, but remove model selection from it. */}
      {/* <Sidebar ... />  <- removing for now as per request to focus on chat bar selection */}
      
      <main className="main-content">
        {/* Top Floating Bar for Models */}
        <div className="model-selector-group">
            <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onSelect={handleModelChange}
                type="llm"
                onAdd={handleAddModel}
            />
            <ModelSelector
                models={audioModels}
                selectedModel={selectedAudioModel}
                onSelect={setSelectedAudioModel}
                type="audio"
                onAdd={handleAddModel}
            />
        </div>

        <ChatWindow 
           messages={messages}
           streamingContent={streamingContent}
           isLoading={loading}
           onSend={handleSend}
           audioSrc={audioOutput}
        />
      </main>
    </div>
  );
}

export default App;
