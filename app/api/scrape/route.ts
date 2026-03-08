import { NextResponse } from "next/server"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const REGIONS = [
  "Wien", "Vorarlberg", "Tirol", "Steiermark", "Salzburg",
  "Oberösterreich", "Niederösterreich", "Kärnten", "Burgenland"
]

const MONTH_MAP: Record<string, string> = {
  "jan": "01", "jän": "01", "feb": "02", "mär": "03", "mar": "03",
  "apr": "04", "mai": "05", "jun": "06", "jul": "07", "aug": "08",
  "sep": "09", "okt": "10", "nov": "11", "dez": "12"
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jänner", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember"
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

// Parse the plain text content from the rendered page
function parseTextContent(text: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []
  
  // Split by date pattern: Mär7Sa or Mär6-7Fr - Sa
  // The format is: DateDayOfWeek ## RaceName Location, Region Category Distances
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  let currentDate = ""
  let currentMonth = ""
  let currentYear = "2026"
  let currentDateFormatted = ""
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check for date line: Mär7Sa or Mär6-7Fr - Sa
    const dateMatch = line.match(/^(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)(\d{1,2})(?:-\d{1,2})?(?:[A-Za-z]{2})?(?:\s*-\s*[A-Za-z]{2})?$/i)
    if (dateMatch) {
      const monthStr = dateMatch[1].toLowerCase().slice(0, 3)
      currentMonth = MONTH_MAP[monthStr] || "01"
      const day = dateMatch[2].padStart(2, "0")
      currentYear = parseInt(currentMonth) <= 2 ? "2027" : "2026"
      currentDate = `${currentYear}-${currentMonth}-${day}`
      currentDateFormatted = `${parseInt(day)}. ${MONTH_NAMES[currentMonth]} ${currentYear}`
      continue
    }
    
    // Check for race name line: ## RaceName or just bold race name
    const raceNameMatch = line.match(/^##\s*(.+)$/)
    if (raceNameMatch && currentDate) {
      const raceName = raceNameMatch[1].trim()
      
      // Skip navigation/header items
      if (/^(Laufkalender|Home|Menu|Suche|Filter|Monatliche|Entdecken|Halbmarathons|Marathons)/i.test(raceName)) {
        continue
      }
      
      // Look ahead for location and details
      let location = ""
      let region = ""
      let category = "Laufrennen"
      const distances: string[] = []
      
      // Check next lines for location and details
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j]
        
        // Check for location, region pattern
        for (const r of REGIONS) {
          const locMatch = nextLine.match(new RegExp(`^([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]+),\\s*${r}$`, "i"))
          if (locMatch) {
            location = locMatch[1].trim()
            region = r
            break
          }
        }
        
        // Check for category
        const categories = ["Trailrun", "Triathlon", "Hindernislauf", "Duathlon", "Aquathlon"]
        for (const cat of categories) {
          if (nextLine.includes(cat)) {
            category = cat
          }
        }
        
        // Check for distances
        const distMatches = [...nextLine.matchAll(/(\d+(?:[,\.]\d+)?)\s*km/gi)]
        for (const dm of distMatches) {
          if (!distances.includes(dm[0]) && distances.length < 8) {
            distances.push(dm[0])
          }
        }
        
        // Check for Halbmarathon
        if (nextLine.toLowerCase().includes("halbmarathon") && !distances.some(d => d.includes("21"))) {
          distances.push("21.1 km")
        }
        
        // If we hit another date or race name, stop looking
        if (nextLine.match(/^(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\d/i) || nextLine.startsWith("##")) {
          break
        }
      }
      
      // Only add if we found a region
      if (region && !races.some(r => r.name === raceName && r.date === currentDate)) {
        races.push({
          id: `p${pageNum}-${races.length}`,
          date: currentDate,
          dateFormatted: currentDateFormatted,
          name: raceName,
          location: location || region,
          region,
          category,
          distances,
          month: currentMonth,
          year: currentYear,
          imageUrl: undefined
        })
      }
    }
  }
  
  return races
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const targetUrl = page === 1
      ? "https://running.life/laufkalender/osterreich"
      : `https://running.life/laufkalender/osterreich?page=${page}`

    // Use r.jina.ai to get rendered content as markdown/text
    // This service renders JavaScript and returns clean text
    const jinaUrl = `https://r.jina.ai/${targetUrl}`
    
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0 (compatible; RaceCalendarBot/1.0)"
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Jina fetch failed: ${response.status}`,
        races: [],
        page,
        hasMore: page < 35,
        totalPages: 35
      })
    }

    const text = await response.text()
    
    // Parse the text content
    const races = parseTextContent(text, page)
    
    // Get total pages from first page
    let totalPages = 33
    if (page === 1) {
      const countMatch = text.match(/(\d+)\s*Rennen/i)
      if (countMatch) {
        totalPages = Math.ceil(parseInt(countMatch[1]) / 20)
      }
    }

    return NextResponse.json({
      success: true,
      races,
      page,
      hasMore: page < totalPages,
      totalPages,
      debug: {
        textLength: text.length,
        textSample: text.slice(0, 1000),
        racesFound: races.length
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      races: [],
      page,
      hasMore: page < 35,
      totalPages: 35
    })
  }
}
