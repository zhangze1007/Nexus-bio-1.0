export interface PathwayNode {
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;
}

export interface SearchResult {
  id: string;
  title: string;
  extract: string;
  sourceLink: string;
  keywords: string[];
}
