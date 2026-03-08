export interface RaceEvent {
  id: string
  date: string
  dateRange?: string
  name: string
  location: string
  region: string
  category: string
  distances: string[]
  imageUrl?: string
  eventUrl?: string
  month?: string
  year?: string
}

export interface ScrapeStatistics {
  byRegion: Record<string, number>
  byCategory: Record<string, number>
  byMonth: Record<string, number>
}

export interface ScrapeResponse {
  success: boolean
  count: number
  pagesScraped?: number
  totalPagesExpected?: number
  scrapedAt: string
  sourceUrl: string
  statistics?: ScrapeStatistics
  data: RaceEvent[]
  error?: string
}
