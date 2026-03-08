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
  imageUrl?: string
  eventUrl?: string
  month: string
  year: string
}

const MONTHS: Record<string, string> = {
  'Januar': '01', 'Jan': '01',
  'Februar': '02', 'Feb': '02',
  'März': '03', 'Mär': '03',
  'April': '04', 'Apr': '04',
  'Mai': '05',
  'Juni': '06', 'Jun': '06',
  'Juli': '07', 'Jul': '07',
  'August': '08', 'Aug': '08',
  'September': '09', 'Sep': '09',
  'Oktober': '10', 'Okt': '10',
  'November': '11', 'Nov': '11',
  'Dezember': '12', 'Dez': '12'
}

const CATEGORIES = [
  'Trailrun', 'Triathlon', 'Hindernislauf', 'Straßenrennen', 'Urban Trail',
  'Backyard Ultra', 'Multisport', 'Aquathlon', 'Crossduathlon', 'Duathlon', 'Crosstriathlon'
]

const REGIONS = [
  'Wien', 'Vorarlberg', 'Tirol', 'Steiermark', 'Salzburg', 
  'Oberösterreich', 'Niederösterreich', 'Kärnten', 'Burgenland'
]

async function fetchPage(pageNum: number): Promise<string> {
  const baseUrl = 'https://running.life/laufkalender/osterreich'
  const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${pageNum}: ${response.status}`)
  }
  
  return response.text()
}

function extractTextContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#\d+;/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

function parseEventsFromText(text: string, existingCount: number): RaceEvent[] {
  const races: RaceEvent[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  
  let currentMonth = ''
  let currentYear = '2026'
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    // Check for month/year header like "März 2026" or "April 2026"
    const monthYearMatch = line.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})$/i)
    if (monthYearMatch) {
      currentMonth = MONTHS[monthYearMatch[1]] || ''
      currentYear = monthYearMatch[2]
      i++
      continue
    }
    
    // Check for date pattern like "Mär7Sa" or "Mär6-7Fr - Sa" or "Apr12So"
    const dateMatch = line.match(/^([A-Za-zäöü]{3})(\d{1,2})(?:-(\d{1,2}))?([A-Za-z\s-]*)$/)
    
    if (dateMatch) {
      const monthAbbr = dateMatch[1]
      const monthNum = MONTHS[monthAbbr] || MONTHS[monthAbbr.charAt(0).toUpperCase() + monthAbbr.slice(1).toLowerCase()]
      
      if (monthNum) {
        if (monthNum !== currentMonth) {
          currentMonth = monthNum
        }
        
        const day = dateMatch[2].padStart(2, '0')
        const endDay = dateMatch[3] ? dateMatch[3].padStart(2, '0') : null
        const dateStr = `${currentYear}-${monthNum}-${day}`
        const dateRange = endDay ? `${day}-${endDay}` : undefined
        
        // Move to next line to look for event name
        i++
        
        // Skip day abbreviations like "Fr - Sa" or "So"
        while (i < lines.length && /^(Mo|Di|Mi|Do|Fr|Sa|So)(\s*-\s*(Mo|Di|Mi|Do|Fr|Sa|So))?$/.test(lines[i])) {
          i++
        }
        
        if (i >= lines.length) break
        
        // This should be the event name
        const eventName = lines[i]
        
        // Skip if it looks like another date or section header
        if (eventName.match(/^[A-Za-zäöü]{3}\d{1,2}/) || eventName.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/i)) {
          continue
        }
        
        i++
        
        // Look for location (format: "City, Region")
        let location = ''
        let region = ''
        
        while (i < lines.length) {
          const locLine = lines[i]
          
          // Check if this line is a location with region
          const locMatch = locLine.match(/^([^,]+),\s*(.+)$/)
          if (locMatch) {
            location = locMatch[1].trim()
            region = locMatch[2].trim()
            i++
            break
          }
          
          // If we hit another date pattern, break
          if (locLine.match(/^[A-Za-zäöü]{3}\d{1,2}/)) {
            break
          }
          
          i++
        }
        
        if (!location || !region) {
          continue
        }
        
        // Validate region is a known Austrian region
        const isValidRegion = REGIONS.some(r => region.includes(r))
        if (!isValidRegion) {
          continue
        }
        
        // Look for category and distances
        let category = 'Straßenrennen'
        const distances: string[] = []
        
        // Check next few lines for category and distances
        const checkLines = Math.min(5, lines.length - i)
        for (let j = 0; j < checkLines; j++) {
          const detailLine = lines[i + j]
          
          // Stop if we hit another date or location
          if (detailLine.match(/^[A-Za-zäöü]{3}\d{1,2}/) || detailLine.includes(',')) {
            break
          }
          
          // Check for category
          const foundCategory = CATEGORIES.find(cat => detailLine === cat || detailLine.startsWith(cat + ' '))
          if (foundCategory) {
            category = foundCategory
          }
          
          // Check for distances
          const distMatches = detailLine.match(/(\d+\s*km|Halbmarathon|Marathon|\d+\s*hr)/gi)
          if (distMatches) {
            for (const dist of distMatches) {
              const normalized = dist.trim()
              if (!distances.includes(normalized)) {
                distances.push(normalized)
              }
            }
          }
        }
        
        races.push({
          id: `race-${existingCount + races.length + 1}`,
          date: dateStr,
          dateRange,
          name: eventName,
          location,
          region,
          category,
          distances,
          month: currentMonth,
          year: currentYear,
          imageUrl: undefined,
          eventUrl: `https://running.life/laufkalender/osterreich`
        })
      }
    }
    
    i++
  }
  
  return races
}

function getTotalPages(text: string): number {
  // Look for total race count like "650 Rennen"
  const countMatch = text.match(/(\d+)\s*Rennen/i)
  if (countMatch) {
    const totalRaces = parseInt(countMatch[1])
    // Approximately 20 events per page
    return Math.ceil(totalRaces / 20)
  }
  return 35 // Default to 35 pages (~700 events)
}

async function scrapeAllRaces(): Promise<{ races: RaceEvent[], pagesScraped: number, totalExpected: number }> {
  const allRaces: RaceEvent[] = []
  
  // First, fetch page 1 to get total count
  const firstPageHtml = await fetchPage(1)
  const firstPageText = extractTextContent(firstPageHtml)
  const totalPages = getTotalPages(firstPageText)
  
  // Parse first page
  const firstPageRaces = parseEventsFromText(firstPageText, 0)
  allRaces.push(...firstPageRaces)
  
  // Fetch remaining pages in batches to avoid overwhelming the server
  const BATCH_SIZE = 5
  let pagesScraped = 1
  
  for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
    const pagePromises: Promise<string>[] = []
    
    for (let page = batchStart; page <= batchEnd; page++) {
      pagePromises.push(fetchPage(page))
    }
    
    try {
      const pageResults = await Promise.all(pagePromises)
      
      for (const html of pageResults) {
        const text = extractTextContent(html)
        const pageRaces = parseEventsFromText(text, allRaces.length)
        allRaces.push(...pageRaces)
        pagesScraped++
      }
    } catch (error) {
      console.error(`Error fetching batch starting at page ${batchStart}:`, error)
      // Continue with next batch
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Deduplicate by name + date + location
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
  uniqueRaces.forEach((race, index) => {
    race.id = `race-${index + 1}`
  })
  
  return {
    races: uniqueRaces,
    pagesScraped,
    totalExpected: totalPages
  }
}

export async function GET() {
  try {
    const { races, pagesScraped, totalExpected } = await scrapeAllRaces()
    
    // Calculate statistics
    const regionCounts: Record<string, number> = {}
    const categoryCounts: Record<string, number> = {}
    const monthCounts: Record<string, number> = {}
    
    for (const race of races) {
      regionCounts[race.region] = (regionCounts[race.region] || 0) + 1
      categoryCounts[race.category] = (categoryCounts[race.category] || 0) + 1
      const monthYear = `${race.year}-${race.month}`
      monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1
    }
    
    return NextResponse.json({ 
      success: true, 
      count: races.length,
      pagesScraped,
      totalPagesExpected: totalExpected,
      scrapedAt: new Date().toISOString(),
      sourceUrl: 'https://running.life/laufkalender/osterreich',
      statistics: {
        byRegion: regionCounts,
        byCategory: categoryCounts,
        byMonth: monthCounts
      },
      data: races 
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to scrape data',
      data: [] 
    }, { status: 500 })
  }
}
