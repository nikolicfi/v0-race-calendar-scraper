import { NextResponse } from 'next/server'

export interface RaceEvent {
  id: string
  date: string
  dateRange?: string
  name: string
  location: string
  region: string
  category: string
  distances: string[]
  month: string
  year: string
  eventUrl?: string
}

export const maxDuration = 60

const MONTH_MAP: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03',
  'apr': '04', 'mai': '05', 'jun': '06', 'jul': '07',
  'aug': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'dez': '12'
}

const CATEGORIES = [
  'Trailrun', 'Triathlon', 'Hindernislauf', 'Urban Trail',
  'Backyard Ultra', 'Multisport', 'Aquathlon', 'Crossduathlon', 
  'Duathlon', 'Crosstriathlon'
]

const REGIONS = [
  'Wien', 'Vorarlberg', 'Tirol', 'Steiermark', 'Salzburg', 
  'Oberösterreich', 'Niederösterreich', 'Kärnten', 'Burgenland'
]

async function fetchPage(pageNum: number): Promise<string | null> {
  const baseUrl = 'https://running.life/laufkalender/osterreich'
  const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store'
    })
    
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEventsFromHtml(html: string, startId: number): RaceEvent[] {
  const races: RaceEvent[] = []
  
  // Find the current year from the page
  let currentYear = '2026'
  const yearMatch = html.match(/Laufkalender[^2]*(\d{4})/i)
  if (yearMatch) currentYear = yearMatch[1]
  
  // Extract event blocks - each event starts with a date pattern in a specific structure
  // Looking for: date div -> h2 with event name -> location div -> category/distance div
  
  // First, let's find all the event card sections
  // The HTML structure has events in article or div blocks with dates like "Mär7Sa"
  
  // Simple approach: split by month headers and then find date patterns
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  
  // Find all h2 tags which contain event names
  const h2Matches = text.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)
  
  for (const match of h2Matches) {
    const eventName = decodeHtmlEntities(match[1])
    const position = match.index || 0
    
    // Skip navigation/header h2s
    if (eventName.includes('Laufkalender') || eventName.length < 3) continue
    
    // Look backwards for the date (within 500 chars before the h2)
    const beforeH2 = text.slice(Math.max(0, position - 500), position)
    
    // Match date pattern like "Mär7Sa" or "Mär6-7Fr"
    const dateMatches = [...beforeH2.matchAll(/([A-Za-zäöü]{3})(\d{1,2})(?:-(\d{1,2}))?[A-Za-z\s-]*/g)]
    const lastDateMatch = dateMatches[dateMatches.length - 1]
    
    if (!lastDateMatch) continue
    
    const monthAbbr = lastDateMatch[1].toLowerCase()
    const monthNum = MONTH_MAP[monthAbbr]
    if (!monthNum) continue
    
    const day = lastDateMatch[2].padStart(2, '0')
    const endDay = lastDateMatch[3] ? lastDateMatch[3].padStart(2, '0') : null
    
    // Determine year - if month is Jan or Feb and title has 26/27, might be 2027
    let eventYear = currentYear
    if (parseInt(monthNum) <= 2 && html.includes('2026/27')) {
      eventYear = '2027'
    }
    
    const dateStr = `${eventYear}-${monthNum}-${day}`
    const dateRange = endDay ? `${day}-${endDay}` : undefined
    
    // Look forward for location (within 300 chars after h2)
    const afterH2 = text.slice(position, position + 500)
    
    // Find location pattern: "City, Region"
    const locationMatch = afterH2.match(/([A-Za-zäöüÄÖÜß\s-]+),\s*(Wien|Vorarlberg|Tirol|Steiermark|Salzburg|Oberösterreich|Niederösterreich|Kärnten|Burgenland)/i)
    
    if (!locationMatch) continue
    
    const location = decodeHtmlEntities(locationMatch[1])
    const region = locationMatch[2]
    
    // Find category
    let category = 'Straßenrennen'
    for (const cat of CATEGORIES) {
      if (afterH2.includes(cat)) {
        category = cat
        break
      }
    }
    
    // Find distances
    const distances: string[] = []
    const distMatches = afterH2.matchAll(/(\d+)\s*km|Halbmarathon|Marathon/gi)
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist)) {
        distances.push(dist)
      }
    }
    
    races.push({
      id: `race-${startId + races.length + 1}`,
      date: dateStr,
      dateRange,
      name: eventName,
      location,
      region,
      category,
      distances,
      month: monthNum,
      year: eventYear,
      eventUrl: 'https://running.life/laufkalender/osterreich'
    })
  }
  
  return races
}

function getTotalPages(html: string): number {
  const countMatch = html.match(/(\d+)\s*Rennen/i)
  if (countMatch) {
    return Math.ceil(parseInt(countMatch[1]) / 20)
  }
  return 35
}

export async function GET() {
  console.log('[v0] Starting scrape of running.life...')
  
  try {
    const allRaces: RaceEvent[] = []
    
    // Fetch first page
    const firstPageHtml = await fetchPage(1)
    if (!firstPageHtml) {
      throw new Error('Could not connect to running.life')
    }
    
    const totalPages = getTotalPages(firstPageHtml)
    console.log(`[v0] Total pages: ${totalPages}`)
    
    // Parse first page
    const firstPageRaces = parseEventsFromHtml(firstPageHtml, 0)
    allRaces.push(...firstPageRaces)
    console.log(`[v0] Page 1: ${firstPageRaces.length} races`)
    
    // Fetch remaining pages concurrently in batches
    const BATCH_SIZE = 10
    let pagesScraped = 1
    
    for (let batch = 2; batch <= totalPages; batch += BATCH_SIZE) {
      const batchEnd = Math.min(batch + BATCH_SIZE - 1, totalPages)
      const promises: Promise<string | null>[] = []
      
      for (let p = batch; p <= batchEnd; p++) {
        promises.push(fetchPage(p))
      }
      
      const results = await Promise.all(promises)
      
      for (const html of results) {
        if (html) {
          const pageRaces = parseEventsFromHtml(html, allRaces.length)
          allRaces.push(...pageRaces)
          pagesScraped++
        }
      }
      
      console.log(`[v0] Batch ${batch}-${batchEnd}: total ${allRaces.length} races`)
    }
    
    // Deduplicate by name+date+location
    const seen = new Set<string>()
    const uniqueRaces = allRaces.filter(race => {
      const key = `${race.name}|${race.date}|${race.location}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    // Sort by date
    uniqueRaces.sort((a, b) => a.date.localeCompare(b.date))
    
    // Re-assign IDs
    uniqueRaces.forEach((race, i) => {
      race.id = `race-${i + 1}`
    })
    
    // Calculate statistics
    const byRegion: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    
    for (const race of uniqueRaces) {
      byRegion[race.region] = (byRegion[race.region] || 0) + 1
      byCategory[race.category] = (byCategory[race.category] || 0) + 1
      byMonth[`${race.year}-${race.month}`] = (byMonth[`${race.year}-${race.month}`] || 0) + 1
    }
    
    console.log(`[v0] Complete: ${uniqueRaces.length} unique races from ${pagesScraped} pages`)
    
    return NextResponse.json({ 
      success: true, 
      count: uniqueRaces.length,
      pagesScraped,
      totalPagesExpected: totalPages,
      scrapedAt: new Date().toISOString(),
      sourceUrl: 'https://running.life/laufkalender/osterreich',
      statistics: { byRegion, byCategory, byMonth },
      data: uniqueRaces 
    })
  } catch (error) {
    console.error('[v0] Scrape error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to scrape',
      data: [] 
    }, { status: 500 })
  }
}
