import React, { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

interface ApiResponse {
  technical: string | any;
  professional: string | any;
}

function App() {
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await axios.post<ApiResponse>("http://localhost:3000/api/generate", { code });
      setResult(resp.data);
      console.log("API response:", resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const formatText = (text: string | any) => {
    if (typeof text === "string") return text;
    if (Array.isArray(text)) return text.join("\n");
    return JSON.stringify(text, null, 2);
  };

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>LLM Scribe: Code to Doc</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="code-input" style={{ fontWeight: "bold" }}>Paste code snippet:</label>
        <textarea
          id="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={12}
          placeholder="Paste your function or code snippet here..."
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: 14,
            marginTop: 8,
            padding: 12,
            borderRadius: 6,
            border: "1px solid #ccc",
            boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="submit"
            disabled={!code || loading}
            style={{
              backgroundColor: "#1E90FF",
              color: "white",
              padding: "12px 24px",
              fontSize: "16px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            {loading ? "Generating..." : "Generate Docs"}
          </button>
        </div>
      </form>

      {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2>Technical Summary (PolyCoder)</h2>
            <div style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              backgroundColor: "#f9f9f9",
              whiteSpace: "pre-wrap",
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {formatText(result.technical)}
              </ReactMarkdown>
            </div>
          </div>

          <div>
            <h2>Explanation</h2>
            <div style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              backgroundColor: "#f5f5ff",
              whiteSpace: "pre-wrap",
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {formatText(result.professional)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
