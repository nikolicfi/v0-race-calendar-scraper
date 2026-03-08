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
}

export interface ScrapeResponse {
  success: boolean
  count: number
  scrapedAt: string
  sourceUrl: string
  data: RaceEvent[]
  error?: string
}
