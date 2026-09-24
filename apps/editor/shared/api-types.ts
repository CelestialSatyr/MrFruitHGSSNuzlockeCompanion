import type { RunSeries, SemanticValidationIssue, YouTubeEpisodeMetadata } from "@nuzlocke/core";

export interface EditorValidationSummary {
  valid: boolean;
  schemaIssues: Array<{ path: string; message: string }>;
  semanticIssues: SemanticValidationIssue[];
}

export interface EditorGitStatus {
  available: boolean;
  branch?: string;
  remote?: string;
  dirtyPaths: string[];
  unrelatedDirtyPaths: string[];
}

export interface EditorPublishedSummary {
  runCount: number;
  episodeCount: number;
  eventCount: number;
  pokemonCount: number;
  soulLinkCount: number;
}

export interface EditorBootstrapResponse {
  draft: RunSeries;
  validation: EditorValidationSummary;
  draftExists: boolean;
  youtubeConfigured: boolean;
  git: EditorGitStatus;
  published: EditorPublishedSummary;
}

export interface EditorSaveResponse {
  draft: RunSeries;
  validation: EditorValidationSummary;
  savedAt: string;
}

export interface YouTubeImportResponse {
  metadata: YouTubeEpisodeMetadata;
}

export interface YouTubeChannelProfileResponse {
  channelId: string;
  title: string;
  channelUrl: string;
  avatarUrl: string;
}

export interface PokemonSpeciesOption {
  id: number;
  name: string;
}

export interface PokemonAbilityOption {
  id: string;
  name: string;
}

export interface PublishRequest {
  push: boolean;
  commitMessage?: string;
}

export interface PublishResponse {
  published: EditorPublishedSummary;
  backupPath: string;
  git: {
    attempted: boolean;
    committed: boolean;
    pushed: boolean;
    commitMessage?: string;
  };
}

export interface EntityDiffSummary {
  added: string[];
  changed: string[];
  removed: string[];
}

export interface PublishDiffResponse {
  publicDataset: EditorPublishedSummary;
  seriesChanged: boolean;
  runs: EntityDiffSummary;
  episodes: EntityDiffSummary;
  events: EntityDiffSummary;
  pokemon: EntityDiffSummary;
  soulLinks: EntityDiffSummary;
  rules: EntityDiffSummary;
  tags: EntityDiffSummary;
}

export interface EditorBackupSummary {
  id: string;
  createdAt: string;
  runCount: number;
  episodeCount: number;
  eventCount: number;
  pokemonCount: number;
  soulLinkCount: number;
}

export interface BackupsResponse {
  backups: EditorBackupSummary[];
}

export interface RestoreBackupResponse {
  draft: RunSeries;
  validation: EditorValidationSummary;
  restoredBackupId: string;
}
