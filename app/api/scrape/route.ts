export const maxDuration = 60
export const dynamic = 'force-dynamic'

const REGIONS = [
  'Wien', 'Vorarlberg', 'Tirol', 'Steiermark', 'Salzburg', 
  'Oberösterreich', 'Niederösterreich', 'Kärnten', 'Burgenland'
]

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jänner', '02': 'Februar', '03': 'März', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember'
}

interface RaceEvent {
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

async function fetchPage(pageNum: number): Promise<string | null> {
  const baseUrl = 'https://running.life/laufkalender/osterreich'
  const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function parseEventsFromHtml(html: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []
  
  // Clean HTML
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  
  // Decode entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))

  // Find all event cards/entries
  // Pattern: Look for links to /lauf/ pages (individual event pages)
  const eventLinkPattern = /<a[^>]+href=["']([^"']*\/lauf\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  const matches = [...text.matchAll(eventLinkPattern)]
  
  for (const match of matches) {
    const eventUrl = match[1]
    const linkContent = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    
    if (linkContent.length < 5 || linkContent.length > 120) continue
    if (/^(Home|Menu|Suche|Filter|Cookie)/i.test(linkContent)) continue
    
    const position = match.index || 0
    const contextBefore = text.slice(Math.max(0, position - 500), position)
    const contextAfter = text.slice(position, Math.min(text.length, position + 800))
    const fullContext = contextBefore + contextAfter
    
    // Find region
    let region = ''
    let location = ''
    
    for (const r of REGIONS) {
      const regionPattern = new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,35}),\\s*${r}(?![a-z])`, 'i')
      const regionMatch = fullContext.match(regionPattern)
      if (regionMatch) {
        region = r
        location = regionMatch[1].trim()
        break
      }
    }
    
    if (!region) continue
    
    // Find date - patterns like "Mär7", "7. März", "März 7", etc.
    let date = ''
    let dateFormatted = ''
    let month = ''
    let year = '2026'
    
    const monthMap: Record<string, string> = {
      'jan': '01', 'jän': '01', 'feb': '02', 'mär': '03', 'mar': '03',
      'apr': '04', 'mai': '05', 'may': '05', 'jun': '06', 
      'jul': '07', 'aug': '08', 'sep': '09', 'okt': '10', 
      'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12'
    }
    
    // Try different date patterns
    const datePatterns = [
      /(Jan|Jän|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)\s*(\d{1,2})/i,
      /(\d{1,2})\.?\s*(Jan|Jän|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)/i,
      /(\d{1,2})\.(\d{1,2})\./
    ]
    
    for (const pattern of datePatterns) {
      const dateMatch = contextBefore.match(pattern)
      if (dateMatch) {
        let day: string
        let monthStr: string
        
        if (pattern === datePatterns[2]) {
          // DD.MM. format
          day = dateMatch[1].padStart(2, '0')
          month = dateMatch[2].padStart(2, '0')
        } else if (/^\d/.test(dateMatch[1])) {
          // Day first
          day = dateMatch[1].padStart(2, '0')
          monthStr = dateMatch[2].toLowerCase().slice(0, 3)
          month = monthMap[monthStr] || '01'
        } else {
          // Month first
          monthStr = dateMatch[1].toLowerCase().slice(0, 3)
          month = monthMap[monthStr] || '01'
          day = dateMatch[2].padStart(2, '0')
        }
        
        if (parseInt(month) <= 2 && html.includes('2027')) {
          year = '2027'
        }
        
        date = `${year}-${month}-${day}`
        dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
        break
      }
    }
    
    if (!date) continue
    
    // Find category
    let category = 'Laufrennen'
    const categories = ['Trailrun', 'Trail Run', 'Triathlon', 'Hindernislauf', 'Urban Trail', 
                       'Backyard Ultra', 'Multisport', 'Aquathlon', 'Crossduathlon', 'Duathlon', 
                       'Crosstriathlon', 'Marathon', 'Halbmarathon', 'Ultramarathon', 'Berglauf']
    
    for (const cat of categories) {
      if (fullContext.toLowerCase().includes(cat.toLowerCase())) {
        category = cat
        break
      }
    }
    
    // Find distances
    const distances: string[] = []
    const distPattern = /(\d+(?:[,\.]\d+)?)\s*km/gi
    const distMatches = contextAfter.matchAll(distPattern)
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist) && distances.length < 8) {
        distances.push(dist)
      }
    }
    
    // Find image
    let imageUrl: string | undefined
    const imgPattern = new RegExp(`<img[^>]+src=["']([^"']+)["'][^>]*>`, 'gi')
    const nearbyHtml = html.slice(Math.max(0, position - 1000), position + 500)
    const imgMatch = nearbyHtml.match(imgPattern)
    if (imgMatch) {
      const srcMatch = imgMatch[0].match(/src=["']([^"']+)["']/)
      if (srcMatch && srcMatch[1] && !srcMatch[1].includes('data:') && !srcMatch[1].includes('logo')) {
        imageUrl = srcMatch[1]
        if (imageUrl.startsWith('/')) {
          imageUrl = `https://running.life${imageUrl}`
        }
      }
    }
    
    races.push({
      id: `p${pageNum}-${races.length}`,
      date,
      dateFormatted,
      name: linkContent,
      location,
      region,
      category,
      distances,
      month,
      year,
      imageUrl
    })
  }
  
  return races
}

function getTotalPages(html: string): number {
  const countMatch = html.match(/(\d+)\s*(?:Rennen|Events|Veranstaltungen)/i)
  if (countMatch) {
    const total = parseInt(countMatch[1])
    return Math.ceil(total / 20)
  }
  
  const pageMatches = [...html.matchAll(/page=(\d+)/g)]
  if (pageMatches.length > 0) {
    const pages = pageMatches.map(m => parseInt(m[1]))
    return Math.max(...pages, 35)
  }
  
  return 35
}

export async function GET() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      
      try {
        const allRaces: RaceEvent[] = []
        let pagesScraped = 0
        let totalPagesExpected = 35
        
        // Fetch first page
        send({ type: 'status', message: 'Connecting to running.life...', progress: 0 })
        
        const firstPageHtml = await fetchPage(1)
        
        if (!firstPageHtml) {
          send({ type: 'error', message: 'Could not connect to running.life. Please try again.' })
          controller.close()
          return
        }
        
        totalPagesExpected = getTotalPages(firstPageHtml)
        send({ type: 'status', message: `Found ${totalPagesExpected} pages to scrape`, progress: 2, totalPages: totalPagesExpected })
        
        // Parse first page
        const firstPageRaces = parseEventsFromHtml(firstPageHtml, 1)
        allRaces.push(...firstPageRaces)
        pagesScraped = 1
        
        send({ 
          type: 'progress', 
          pagesScraped, 
          totalPages: totalPagesExpected, 
          racesFound: allRaces.length,
          progress: Math.round((pagesScraped / totalPagesExpected) * 100)
        })
        
        // Fetch remaining pages in batches
        const BATCH_SIZE = 5
        
        for (let batchStart = 2; batchStart <= totalPagesExpected; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPagesExpected)
          const pagePromises: Promise<{ pageNum: number; html: string | null }>[] = []
          
          for (let p = batchStart; p <= batchEnd; p++) {
            pagePromises.push(
              fetchPage(p).then(html => ({ pageNum: p, html }))
            )
          }
          
          send({ 
            type: 'status', 
            message: `Fetching pages ${batchStart}-${batchEnd}...`,
            progress: Math.round((batchStart / totalPagesExpected) * 100)
          })
          
          const results = await Promise.all(pagePromises)
          
          for (const { pageNum, html } of results) {
            if (html) {
              const pageRaces = parseEventsFromHtml(html, pageNum)
              allRaces.push(...pageRaces)
              pagesScraped++
            }
          }
          
          send({ 
            type: 'progress', 
            pagesScraped, 
            totalPages: totalPagesExpected, 
            racesFound: allRaces.length,
            progress: Math.round((pagesScraped / totalPagesExpected) * 100)
          })
          
          // Small delay between batches
          await new Promise(r => setTimeout(r, 200))
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
        
        send({ 
          type: 'complete', 
          success: true,
          count: uniqueRaces.length,
          pagesScraped,
          totalPagesExpected,
          scrapedAt: new Date().toISOString(),
          statistics: { byRegion, byCategory, byMonth },
          data: uniqueRaces
        })
        
      } catch (error) {
        send({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
        })
      } finally {
        controller.close()
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
