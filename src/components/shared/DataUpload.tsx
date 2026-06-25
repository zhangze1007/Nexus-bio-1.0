"use client";
import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { THEME } from "../../theme";

interface DataUploadProps {
  onUpload: (data: Record<string, string>[], headers: string[]) => void;
  onError?: (error: string) => void;
  accept?: string;
  label?: string;
}

export default function DataUpload({
  onUpload,
  onError,
  accept = ".csv,.tsv",
  label = "Upload Data",
}: DataUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) throw new Error("File must have at least a header row and one data row");

    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));

    const rows = lines.slice(1).map((line, i) => {
      const values = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 2}: expected ${headers.length} columns, got ${values.length}`);
      }
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = values[j];
      });
      return row;
    });

    return { headers, rows };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setIsParsing(true);
      try {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        onUpload(rows, headers);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Failed to parse file");
      } finally {
        setIsParsing(false);
      }
    },
    [parseCSV, onUpload, onError],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        padding: "20px",
        borderRadius: THEME.R_MD,
        border: `2px dashed ${isDragging ? THEME.MINT : THEME.BORDER}`,
        background: isDragging ? "rgba(191,220,205,0.08)" : "transparent",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.2s ease",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Upload size={20} color={isDragging ? THEME.MINT : THEME.DIM} style={{ marginBottom: "8px" }} />
      <div style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: isDragging ? THEME.VALUE : THEME.LABEL }}>
        {isParsing ? "Parsing..." : label}
      </div>
      <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, marginTop: "4px" }}>
        Drag & drop or click · CSV/TSV format
      </div>
    </div>
  );
}
