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

  // Decode HTML entities
  let text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))

  // Try multiple parsing strategies
  
  // Strategy 1: Look for event card divs with data attributes or classes
  const cardPatterns = [
    /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<li[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  ]
  
  let foundCards: string[] = []
  for (const pattern of cardPatterns) {
    const matches = [...text.matchAll(pattern)]
    if (matches.length > 0) {
      foundCards = matches.map(m => m[0])
      break
    }
  }

  // Strategy 2: Split by date headers (Mär7, Apr15 format)
  if (foundCards.length === 0) {
    // Look for date patterns followed by content
    const dateBlockPattern = /((?:Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\d{1,2}(?:-\d{1,2})?)([\s\S]*?)(?=(?:Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\d{1,2}|$)/gi
    const dateBlocks = [...text.matchAll(dateBlockPattern)]
    
    for (const block of dateBlocks) {
      const dateStr = block[1]
      const content = block[2]
      
      // Parse the date
      const dateMatch = dateStr.match(/(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)(\d{1,2})/i)
      if (!dateMatch) continue
      
      const monthStr = dateMatch[1].toLowerCase().slice(0, 3)
      const month = MONTH_MAP[monthStr] || "01"
      const day = dateMatch[2].padStart(2, "0")
      let year = "2026"
      if (parseInt(month) <= 2) year = "2027"
      
      const date = `${year}-${month}-${day}`
      const dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
      
      // Extract race name - look for links or headers
      const namePatterns = [
        /<a[^>]*>([\s\S]*?)<\/a>/i,
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
        /<strong[^>]*>([\s\S]*?)<\/strong>/i,
        /<b[^>]*>([\s\S]*?)<\/b>/i,
      ]
      
      let raceName = ""
      for (const np of namePatterns) {
        const nm = content.match(np)
        if (nm) {
          raceName = nm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
          if (raceName.length >= 3 && raceName.length <= 150) break
          raceName = ""
        }
      }
      
      if (!raceName) continue
      if (/^(Home|Menu|Suche|Filter|Cookie|Mehr|Alle|Impressum)/i.test(raceName)) continue
      
      // Find region
      let region = ""
      let location = ""
      
      for (const r of REGIONS) {
        if (content.includes(r)) {
          region = r
          const locMatch = content.match(new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,40}),?\\s*${r}`, "i"))
          location = locMatch ? locMatch[1].trim() : r
          break
        }
      }
      
      if (!region) continue
      
      // Distances
      const distances: string[] = []
      const distMatches = [...content.matchAll(/(\d+(?:[,\.]\d+)?)\s*km/gi)]
      for (const dm of distMatches) {
        if (!distances.includes(dm[0]) && distances.length < 8) {
          distances.push(dm[0])
        }
      }
      
      // Avoid duplicates
      if (races.some(r => r.name === raceName && r.date === date)) continue
      
      races.push({
        id: `p${pageNum}-${races.length}`,
        date,
        dateFormatted,
        name: raceName,
        location,
        region,
        category: "Laufrennen",
        distances,
        month,
        year,
        imageUrl: undefined
      })
    }
  }

  // Strategy 3: Brute force - find all links with Austrian regions nearby
  if (races.length === 0) {
    const allLinks = [...text.matchAll(/<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    
    for (const link of allLinks) {
      const href = link[1]
      const linkText = link[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      
      // Skip if too short/long or navigation
      if (linkText.length < 3 || linkText.length > 150) continue
      if (/^(Home|Menu|Suche|Filter|Cookie|Mehr|Alle|Seite|Page|\d+|›|«|»|<|>)/i.test(linkText)) continue
      
      const pos = link.index || 0
      const context = text.slice(Math.max(0, pos - 300), Math.min(text.length, pos + 500))
      
      // Must have a region
      let region = ""
      let location = ""
      for (const r of REGIONS) {
        if (context.includes(r)) {
          region = r
          const locMatch = context.match(new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,40}),?\\s*${r}`, "i"))
          location = locMatch ? locMatch[1].trim() : r
          break
        }
      }
      
      if (!region) continue
      
      // Find date
      const dateMatch = context.match(/(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s*(\d{1,2})/i)
      if (!dateMatch) continue
      
      const monthStr = dateMatch[1].toLowerCase().slice(0, 3)
      const month = MONTH_MAP[monthStr] || "01"
      const day = dateMatch[2].padStart(2, "0")
      let year = "2026"
      if (parseInt(month) <= 2) year = "2027"
      
      const date = `${year}-${month}-${day}`
      const dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
      
      // Distances
      const distances: string[] = []
      const distMatches = [...context.matchAll(/(\d+(?:[,\.]\d+)?)\s*km/gi)]
      for (const dm of distMatches) {
        if (!distances.includes(dm[0]) && distances.length < 8) {
          distances.push(dm[0])
        }
      }
      
      // Avoid duplicates
      if (races.some(r => r.name === linkText && r.date === date)) continue
      
      races.push({
        id: `p${pageNum}-${races.length}`,
        date,
        dateFormatted,
        name: linkText,
        location,
        region,
        category: "Laufrennen",
        distances,
        month,
        year,
        imageUrl: undefined
      })
    }
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
        htmlSample: html.slice(0, 500),
        // Get a sample from middle of page to see actual content structure
        htmlMiddle: html.slice(50000, 52000),
        // Count regions found
        regionsFound: REGIONS.filter(r => html.includes(r)).join(", "),
        // Count date patterns
        datePatterns: (html.match(/(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\d{1,2}/gi) || []).length
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
