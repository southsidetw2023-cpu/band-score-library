import structuredSheetsData from './structured-sheets.generated.json'

export type StructuredSheetRowType = 'section' | 'chords' | 'lyrics'

export interface StructuredSheetRow {
  type: StructuredSheetRowType
  text: string
}

export interface StructuredSheetData {
  songId: string
  originalKey: string
  sourceLabel: string
  reviewStatus: 'draft' | 'needs_key_review' | 'verified'
  rows: StructuredSheetRow[]
}

const structuredSheets = structuredSheetsData as Record<string, StructuredSheetData>

export function getStructuredSheet(songId: string) {
  return structuredSheets[songId] ?? null
}

export function getStructuredSheetCount() {
  return Object.keys(structuredSheets).length
}
