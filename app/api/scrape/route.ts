import { NextResponse } from 'next/server'

export interface RaceEvent {
  id: string
  date: string
  dateFormatted: string
  name: string
  location: string
  region: string
  category: string
  distances: string[]
  month: string
  year: string
  imageUrl?: string
}

export const maxDuration = 60

const REGIONS = [
  'Wien', 'Vorarlberg', 'Tirol', 'Steiermark', 'Salzburg', 
  'Oberösterreich', 'Niederösterreich', 'Kärnten', 'Burgenland'
]

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jänner', '02': 'Februar', '03': 'März', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember'
}

async function fetchPage(pageNum: number): Promise<string | null> {
  const baseUrl = 'https://running.life/laufkalender/osterreich'
  const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`
  
  console.log(`[v0] Fetching page ${pageNum}: ${url}`)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de,en-US;q=0.7,en;q=0.3',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.log(`[v0] Page ${pageNum} returned status ${response.status}`)
      return null
    }
    
    const text = await response.text()
    console.log(`[v0] Page ${pageNum} fetched, length: ${text.length}`)
    return text
  } catch (err) {
    console.log(`[v0] Page ${pageNum} fetch error:`, err)
    return null
  }
}

function parseEventsFromText(html: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []
  
  // Remove scripts and styles
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
  
  // Extract images
  const imageMap = new Map<string, string>()
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*Lauf[^"']*)["']/gi)
  for (const img of imgMatches) {
    const [, src, alt] = img
    if (src && alt) {
      imageMap.set(alt.toLowerCase().trim(), src)
    }
  }
  
  // Find event entries - they typically have a heading/link with the event name
  // and location info with "City, Region" format
  
  // Pattern 1: Look for anchor tags that link to event pages
  const linkPattern = /<a[^>]+href=["']([^"']*\/lauf[^"']*)["'][^>]*>([^<]+)<\/a>/gi
  const linkMatches = [...text.matchAll(linkPattern)]
  
  // Pattern 2: Look for headings with event names followed by location
  const headingPattern = /<h[2-4][^>]*>([^<]{5,80})<\/h[2-4]>/gi
  const headingMatches = [...text.matchAll(headingPattern)]
  
  const allMatches = [...linkMatches, ...headingMatches]
  
  for (const match of allMatches) {
    const eventName = match[2] || match[1]
    if (!eventName) continue
    
    const cleanName = eventName
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Skip if too short or looks like navigation
    if (cleanName.length < 5 || cleanName.length > 100) continue
    if (/^(Home|Menu|Suche|Filter|Kalender|Laufkalender|Cookie|Datenschutz|Impressum)/i.test(cleanName)) continue
    
    const position = match.index || 0
    const context = text.slice(position, position + 800)
    
    // Find region in the context
    let region = ''
    let location = ''
    
    for (const r of REGIONS) {
      const regionPattern = new RegExp(`([A-Za-zäöüÄÖÜß\\s-]{2,40}),\\s*${r}`, 'i')
      const regionMatch = context.match(regionPattern)
      if (regionMatch) {
        region = r
        location = regionMatch[1].trim()
        break
      }
    }
    
    if (!region) continue
    
    // Find date in context before the event
    const beforeContext = text.slice(Math.max(0, position - 300), position)
    const afterContext = text.slice(position, position + 300)
    const fullContext = beforeContext + afterContext
    
    // Match date patterns: "Mär 7" or "7. März" or "07.03." or "Mär7Sa"
    let date = ''
    let dateFormatted = ''
    let month = ''
    let year = '2026'
    
    // Pattern: MärXX or Mar XX
    const monthDayPattern = /(Jan|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)\s*(\d{1,2})/i
    const dateMatch = fullContext.match(monthDayPattern)
    
    if (dateMatch) {
      const monthStr = dateMatch[1].toLowerCase()
      const day = dateMatch[2].padStart(2, '0')
      
      const monthMap: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03',
        'apr': '04', 'mai': '05', 'may': '05', 'jun': '06', 
        'jul': '07', 'aug': '08', 'sep': '09', 'okt': '10', 
        'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12'
      }
      
      month = monthMap[monthStr] || '01'
      
      // Check if this should be 2027 (Jan/Feb)
      if (parseInt(month) <= 2 && html.includes('2027')) {
        year = '2027'
      }
      
      date = `${year}-${month}-${day}`
      dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
    }
    
    if (!date) continue
    
    // Find category
    let category = 'Laufrennen'
    const categoryPattern = /(Trailrun|Trail Run|Triathlon|Hindernislauf|Urban Trail|Backyard Ultra|Multisport|Aquathlon|Crossduathlon|Duathlon|Crosstriathlon|Marathon|Halbmarathon)/i
    const catMatch = context.match(categoryPattern)
    if (catMatch) {
      category = catMatch[1]
    }
    
    // Find distances
    const distances: string[] = []
    const distPattern = /(\d+(?:,\d+)?)\s*km/gi
    const distMatches = context.matchAll(distPattern)
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist) && distances.length < 6) {
        distances.push(dist)
      }
    }
    
    // Find image
    const nameKey = cleanName.toLowerCase()
    let imageUrl = imageMap.get(nameKey)
    if (!imageUrl) {
      // Try partial match
      for (const [key, url] of imageMap.entries()) {
        if (nameKey.includes(key) || key.includes(nameKey)) {
          imageUrl = url
          break
        }
      }
    }
    
    races.push({
      id: `p${pageNum}-${races.length}`,
      date,
      dateFormatted,
      name: cleanName,
      location,
      region,
      category,
      distances,
      month,
      year,
      imageUrl
    })
  }
  
  console.log(`[v0] Page ${pageNum} parsed: ${races.length} events`)
  return races
}

function getTotalPages(html: string): number {
  // Look for pagination or total count
  const countMatch = html.match(/(\d+)\s*(?:Rennen|Events|Veranstaltungen)/i)
  if (countMatch) {
    const total = parseInt(countMatch[1])
    return Math.ceil(total / 20)
  }
  
  // Look for last page number in pagination
  const pageMatch = html.match(/page=(\d+)/g)
  if (pageMatch && pageMatch.length > 0) {
    const pages = pageMatch.map(p => parseInt(p.replace('page=', '')))
    return Math.max(...pages)
  }
  
  return 35 // Default estimate
}

export async function GET() {
  console.log('[v0] ======= STARTING SCRAPE =======')
  
  try {
    const allRaces: RaceEvent[] = []
    let pagesScraped = 0
    let totalPagesExpected = 35
    
    // Fetch first page to get total
    console.log('[v0] Fetching first page...')
    const firstPageHtml = await fetchPage(1)
    
    if (!firstPageHtml) {
      console.log('[v0] ERROR: Could not fetch first page')
      return NextResponse.json({ 
        success: false, 
        error: 'Could not connect to running.life - the website may be blocking requests or temporarily unavailable.',
        data: [] 
      }, { status: 503 })
    }
    
    console.log(`[v0] First page HTML length: ${firstPageHtml.length}`)
    
    totalPagesExpected = getTotalPages(firstPageHtml)
    console.log(`[v0] Total pages expected: ${totalPagesExpected}`)
    
    // Parse first page
    const firstPageRaces = parseEventsFromText(firstPageHtml, 1)
    allRaces.push(...firstPageRaces)
    pagesScraped = 1
    
    console.log(`[v0] First page races: ${firstPageRaces.length}`)
    
    // Fetch remaining pages in parallel batches
    const BATCH_SIZE = 8
    
    for (let batchStart = 2; batchStart <= totalPagesExpected; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPagesExpected)
      const pagePromises: Promise<{ pageNum: number; html: string | null }>[] = []
      
      for (let p = batchStart; p <= batchEnd; p++) {
        pagePromises.push(
          fetchPage(p).then(html => ({ pageNum: p, html }))
        )
      }
      
      console.log(`[v0] Fetching batch pages ${batchStart}-${batchEnd}...`)
      
      const results = await Promise.all(pagePromises)
      
      for (const { pageNum, html } of results) {
        if (html) {
          const pageRaces = parseEventsFromText(html, pageNum)
          allRaces.push(...pageRaces)
          pagesScraped++
        }
      }
      
      console.log(`[v0] After batch: ${allRaces.length} total races, ${pagesScraped} pages scraped`)
    }
    
    // Deduplicate
    const seen = new Set<string>()
    const uniqueRaces = allRaces.filter(race => {
      const key = `${race.name.toLowerCase()}|${race.date}|${race.location.toLowerCase()}`
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
    
    // Statistics
    const byRegion: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    
    for (const race of uniqueRaces) {
      byRegion[race.region] = (byRegion[race.region] || 0) + 1
      byCategory[race.category] = (byCategory[race.category] || 0) + 1
      const monthKey = `${race.year}-${race.month}`
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
    }
    
    console.log(`[v0] ======= SCRAPE COMPLETE =======`)
    console.log(`[v0] Total unique races: ${uniqueRaces.length}`)
    console.log(`[v0] Pages scraped: ${pagesScraped}`)
    
    return NextResponse.json({ 
      success: true, 
      count: uniqueRaces.length,
      pagesScraped,
      totalPagesExpected,
      scrapedAt: new Date().toISOString(),
      sourceUrl: 'https://running.life/laufkalender/osterreich',
      statistics: { byRegion, byCategory, byMonth },
      data: uniqueRaces 
    })
    
  } catch (error) {
    console.error('[v0] Scrape error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred while scraping.',
      data: [] 
    }, { status: 500 })
  }
}
