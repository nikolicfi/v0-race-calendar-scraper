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

function parseEventsFromHtml(html: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []

  // Clean HTML for text extraction
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")

  // Method 1: Find h2 headers (race names) and extract context around them
  // The website structure shows: date block, then ## RaceName, then location, region
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  const h2Matches = [...text.matchAll(h2Pattern)]
  
  for (const match of h2Matches) {
    const raceName = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    
    // Skip if too short or navigation-like
    if (raceName.length < 3 || raceName.length > 150) continue
    if (/^(Laufkalender|Home|Menu|Suche|Filter|Cookie|Navigation)/i.test(raceName)) continue
    
    const position = match.index || 0
    const contextBefore = text.slice(Math.max(0, position - 500), position)
    const contextAfter = text.slice(position, Math.min(text.length, position + 500))
    
    // Find date in context before (format: Mär7, Apr15, etc. or Mär6-7)
    let date = ""
    let dateFormatted = ""
    let month = ""
    let year = "2026"
    
    // Pattern: Mär7 or Mär6-7
    const datePattern = /(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s*(\d{1,2})(?:\s*-\s*\d{1,2})?/i
    const dateMatch = contextBefore.match(datePattern)
    
    if (dateMatch) {
      const monthStr = dateMatch[1].toLowerCase().slice(0, 3)
      month = MONTH_MAP[monthStr] || "01"
      const day = dateMatch[2].padStart(2, "0")
      
      // If month is Jan or Feb, it's likely 2027
      if (parseInt(month) <= 2) year = "2027"
      
      date = `${year}-${month}-${day}`
      dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
    }
    
    if (!date) continue
    
    // Find location and region in context after
    // Format is usually: City, Region
    let region = ""
    let location = ""
    
    for (const r of REGIONS) {
      // Look for "City, Region" pattern
      const locationPattern = new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,40}),\\s*${r}`, "i")
      const locationMatch = contextAfter.match(locationPattern)
      if (locationMatch) {
        region = r
        location = locationMatch[1].trim()
        break
      }
    }
    
    if (!region) continue
    
    // Determine category
    let category = "Laufrennen"
    const categoryKeywords = [
      { keyword: "Trailrun", cat: "Trailrun" },
      { keyword: "Trail", cat: "Trailrun" },
      { keyword: "Triathlon", cat: "Triathlon" },
      { keyword: "Hindernislauf", cat: "Hindernislauf" },
      { keyword: "Halbmarathon", cat: "Halbmarathon" },
      { keyword: "Marathon", cat: "Marathon" },
      { keyword: "Ultramarathon", cat: "Ultramarathon" },
      { keyword: "Backyard", cat: "Backyard Ultra" },
      { keyword: "Duathlon", cat: "Duathlon" },
      { keyword: "Aquathlon", cat: "Aquathlon" }
    ]
    
    const fullContext = contextBefore + contextAfter
    for (const { keyword, cat } of categoryKeywords) {
      if (fullContext.toLowerCase().includes(keyword.toLowerCase())) {
        category = cat
        break
      }
    }
    
    // Extract distances
    const distances: string[] = []
    const distPattern = /(\d+(?:[,\.]\d+)?)\s*km/gi
    const distMatches = [...contextAfter.matchAll(distPattern)]
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist) && distances.length < 8) {
        distances.push(dist)
      }
    }
    
    // Check for Halbmarathon text (add as distance if present)
    if (contextAfter.toLowerCase().includes("halbmarathon") && !distances.some(d => d.includes("21"))) {
      distances.push("21.1 km")
    }
    
    // Avoid duplicates
    const isDuplicate = races.some(r => r.name === raceName && r.date === date)
    if (isDuplicate) continue
    
    races.push({
      id: `p${pageNum}-${races.length}`,
      date,
      dateFormatted,
      name: raceName,
      location,
      region,
      category,
      distances,
      month,
      year,
      imageUrl: undefined
    })
  }

  return races
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const url = page === 1
      ? "https://running.life/laufkalender/osterreich"
      : `https://running.life/laufkalender/osterreich?page=${page}`

    // Add retry logic for more robust fetching
    let response: Response | null = null
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000) // 15 second timeout per request
        })
        
        if (response.ok) break
        
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        // Wait before retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({
        success: false,
        error: lastError?.message || `HTTP ${response?.status || 'unknown'}`,
        races: [],
        page,
        hasMore: page < 35, // Assume there might be more pages
        totalPages: 35
      })
    }

    const html = await response.text()

    // Get total pages - look for pagination info
    let totalPages = 35
    if (page === 1) {
      // Try to find total race count
      const countMatch = html.match(/(\d+)\s*Rennen/i)
      if (countMatch) {
        totalPages = Math.ceil(parseInt(countMatch[1]) / 20)
      }
      
      // Also try to find highest page number in pagination
      const pageMatches = [...html.matchAll(/page=(\d+)/gi)]
      if (pageMatches.length > 0) {
        const maxFoundPage = Math.max(...pageMatches.map(m => parseInt(m[1])))
        if (maxFoundPage > totalPages) {
          totalPages = maxFoundPage
        }
      }
    }

    // Check if has more pages - look for next page link
    const hasMore = html.includes(`page=${page + 1}`) || page < totalPages

    // Parse races
    const races = parseEventsFromHtml(html, page)
    
    // Debug: count links found in HTML
    const laufLinks = (html.match(/\/lauf\//gi) || []).length
    const allLinks = (html.match(/<a[^>]+href/gi) || []).length
    
    // Check if this looks like a JS-rendered page (minimal content)
    const isJsRendered = html.length < 5000 || (allLinks < 10 && laufLinks === 0)

    return NextResponse.json({
      success: true,
      races,
      page,
      hasMore,
      totalPages,
      debug: {
        htmlLength: html.length,
        laufLinksFound: laufLinks,
        totalLinksFound: allLinks,
        isJsRendered,
        htmlSample: html.slice(0, 500)
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      races: [],
      page,
      hasMore: page < 35, // Don't stop pagination on error
      totalPages: 35
    })
  }
}
