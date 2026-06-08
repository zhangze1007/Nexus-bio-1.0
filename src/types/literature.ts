/**
 * Literature API response types — Europe PMC, Semantic Scholar, OpenAlex, CORE.
 * Used by SemanticSearch.tsx to replace `any` types with proper interfaces.
 */

/** Europe PMC REST API result item */
export interface EuropePMCResultItem {
  id: string;
  title: string;
  abstractText?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: number;
  doi?: string;
  source?: string;
  citedByCount?: number;
  isOpenAccess?: string;
}

/** Semantic Scholar paper */
export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  authors?: SemanticScholarAuthor[];
  venue?: string;
  year?: number;
  externalIds?: { DOI?: string };
  citationCount?: number;
  isOpenAccess?: boolean;
  journal?: { name?: string };
}

export interface SemanticScholarAuthor {
  name: string;
  authorId?: string;
}

/** OpenAlex work */
export interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: OpenAlexAuthorship[];
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string };
  publication_year?: number;
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
}

export interface OpenAlexAuthorship {
  author?: { display_name?: string };
  raw_affiliation_strings?: string[];
}

/** CORE API v3 work item */
export interface COREWorkItem {
  id: string;
  title: string;
  abstract?: string;
  authors?: Array<{ name: string }>;
  journals?: string[];
  yearPublished?: number;
  doi?: string;
  downloadUrl?: string;
}
