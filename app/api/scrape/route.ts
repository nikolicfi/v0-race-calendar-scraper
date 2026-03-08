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
  eventUrl?: string
  imageUrl?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const targetUrl = page === 1
      ? "https://running.life/laufkalender/osterreich"
      : `https://running.life/laufkalender/osterreich?page=${page}`

    // Try multiple fetch strategies
    let html = ""
    let fetchMethod = ""
    
    // Strategy 1: Direct fetch with browser-like headers
    try {
      const directResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      })
      
      if (directResponse.ok) {
        html = await directResponse.text()
        fetchMethod = "direct"
      }
    } catch (e) {
      console.log("[v0] Direct fetch failed:", e)
    }

    // Strategy 2: Try with different URL format
    if (!html || html.length < 10000) {
      try {
        const altUrl = page === 1
          ? "https://running.life/de/calendar?country=austria"
          : `https://running.life/de/calendar?country=austria&page=${page}`
        
        const altResponse = await fetch(altUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000)
        })
        
        if (altResponse.ok) {
          const altHtml = await altResponse.text()
          if (altHtml.length > html.length) {
            html = altHtml
            fetchMethod = "alt-url"
          }
        }
      } catch (e) {
        console.log("[v0] Alt URL fetch failed:", e)
      }
    }

    if (!html) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch page content",
        races: [],
        page,
        hasMore: page < 35,
        totalPages: 35
      })
    }

    // Parse races from HTML
    const races = parseRacesFromHtml(html, page)
    
    // Get total pages
    let totalPages = 33
    const countMatch = html.match(/(\d+)\s*Rennen/i)
    if (countMatch) {
      totalPages = Math.ceil(parseInt(countMatch[1]) / 20)
    }

    // Debug: find termine links
    const termineLinks = (html.match(/\/de\/termine\/[a-z0-9-]+/gi) || [])
    const uniqueTermine = [...new Set(termineLinks)]

    return NextResponse.json({
      success: true,
      races,
      page,
      hasMore: page < totalPages,
      totalPages,
      debug: {
        htmlLength: html.length,
        fetchMethod,
        termineLinksFound: uniqueTermine.length,
        termineExamples: uniqueTermine.slice(0, 5),
        racesFound: races.length,
        htmlSample: html.slice(0, 500),
        htmlMiddle: html.slice(Math.floor(html.length / 2), Math.floor(html.length / 2) + 1000)
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

function parseRacesFromHtml(html: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []

  // Decode HTML entities
  let text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))

  // Find all /de/termine/ links - these are individual race pages
  // Pattern: /de/termine/race-slug
  const terminePattern = /href=["']([^"']*\/de\/termine\/([a-z0-9-]+))["']/gi
  const termineMatches = [...text.matchAll(terminePattern)]
  
  // Also try /lauf/ links as fallback
  const laufPattern = /href=["']([^"']*\/lauf\/([a-z0-9-]+))["']/gi  
  const laufMatches = [...text.matchAll(laufPattern)]
  
  const allMatches = [...termineMatches, ...laufMatches]
  
  // Track unique races by URL
  const seenUrls = new Set<string>()
  
  for (const match of allMatches) {
    const fullUrl = match[1].startsWith("http") ? match[1] : `https://running.life${match[1]}`
    const slug = match[2]
    
    // Skip if already seen
    if (seenUrls.has(fullUrl)) continue
    seenUrls.add(fullUrl)
    
    // Skip non-race links
    if (slug.length < 3) continue
    if (/^(page|filter|search|login|register|home|about|contact|impressum|datenschutz|agb|faq)$/i.test(slug)) continue
    
    // Get context around this link
    const pos = match.index || 0
    const contextBefore = text.slice(Math.max(0, pos - 500), pos)
    const contextAfter = text.slice(pos, Math.min(text.length, pos + 800))
    const fullContext = contextBefore + contextAfter
    
    // Extract race name from the link text or nearby heading
    let raceName = ""
    
    // Look for the link text
    const linkEndPos = text.indexOf("</a>", pos)
    if (linkEndPos > pos) {
      const linkContent = text.slice(pos, linkEndPos)
      const textMatch = linkContent.match(/>([^<]+)/)
      if (textMatch) {
        raceName = textMatch[1].replace(/\s+/g, " ").trim()
      }
    }
    
    // If no name from link, try to extract from slug
    if (!raceName || raceName.length < 3) {
      raceName = slug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    }
    
    // Skip navigation items
    if (/^(Home|Menu|Suche|Filter|Mehr|Alle|Monatliche|Entdecken)/i.test(raceName)) continue
    
    // Find date in context
    let date = ""
    let dateFormatted = ""
    let month = ""
    let year = "2026"
    
    // Pattern: Mär7 or Mar 7 or 7. März etc
    const datePatterns = [
      /(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s*(\d{1,2})(?:-\d{1,2})?/i,
      /(\d{1,2})\.?\s*(Jan(?:uar|uär)?|Feb(?:ruar)?|Mär(?:z)?|Apr(?:il)?|Mai|Jun(?:i)?|Jul(?:i)?|Aug(?:ust)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Dez(?:ember)?)/i,
      /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/
    ]
    
    for (const pattern of datePatterns) {
      const dateMatch = fullContext.match(pattern)
      if (dateMatch) {
        if (dateMatch[3]) {
          // DD.MM.YYYY format
          const day = dateMatch[1].padStart(2, "0")
          month = dateMatch[2].padStart(2, "0")
          year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]
          date = `${year}-${month}-${day}`
          dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month] || month} ${year}`
        } else {
          // Mär7 or 7. März format
          let monthStr: string
          let dayStr: string
          
          if (/^\d/.test(dateMatch[1])) {
            // 7. März format
            dayStr = dateMatch[1]
            monthStr = dateMatch[2].toLowerCase().slice(0, 3)
          } else {
            // Mär7 format
            monthStr = dateMatch[1].toLowerCase().slice(0, 3)
            dayStr = dateMatch[2]
          }
          
          month = MONTH_MAP[monthStr] || "01"
          const day = dayStr.padStart(2, "0")
          year = parseInt(month) <= 2 ? "2027" : "2026"
          date = `${year}-${month}-${day}`
          dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
        }
        break
      }
    }
    
    // Find region
    let region = ""
    let location = ""
    
    for (const r of REGIONS) {
      if (fullContext.includes(r)) {
        region = r
        // Try to find city before region
        const locMatch = fullContext.match(new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,40}),?\\s*${r}`, "i"))
        if (locMatch) {
          location = locMatch[1].trim()
        } else {
          location = r
        }
        break
      }
    }
    
    // If no region found but we have a date, still add the race
    if (!region) {
      region = "Österreich"
      location = "Österreich"
    }
    
    // If no date, use a default
    if (!date) {
      const now = new Date()
      month = String(now.getMonth() + 1).padStart(2, "0")
      year = String(now.getFullYear())
      date = `${year}-${month}-15`
      dateFormatted = `${MONTH_NAMES[month]} ${year}`
    }
    
    // Find distances
    const distances: string[] = []
    const distMatches = [...fullContext.matchAll(/(\d+(?:[,\.]\d+)?)\s*km/gi)]
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist) && distances.length < 8 && parseInt(dist) > 0 && parseInt(dist) < 500) {
        distances.push(dist)
      }
    }
    
    // Determine category
    let category = "Laufrennen"
    const categoryMap = [
      { keywords: ["trailrun", "trail run", "trail"], cat: "Trailrun" },
      { keywords: ["triathlon"], cat: "Triathlon" },
      { keywords: ["hindernislauf", "obstacle"], cat: "Hindernislauf" },
      { keywords: ["halbmarathon", "half marathon"], cat: "Halbmarathon" },
      { keywords: ["marathon"], cat: "Marathon" },
      { keywords: ["ultramarathon", "ultra marathon", "ultra"], cat: "Ultramarathon" },
      { keywords: ["duathlon"], cat: "Duathlon" },
    ]
    
    const contextLower = fullContext.toLowerCase()
    for (const { keywords, cat } of categoryMap) {
      if (keywords.some(k => contextLower.includes(k))) {
        category = cat
        break
      }
    }
    
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
      eventUrl: fullUrl,
      imageUrl: undefined
    })
  }

  return races
}
