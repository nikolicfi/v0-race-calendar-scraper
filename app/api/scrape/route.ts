import { NextResponse } from "next/server"

export const maxDuration = 30
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

  // Clean HTML
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")

  // Find event links - /lauf/ pages are individual events
  const eventLinkPattern = /<a[^>]+href=["']([^"']*\/lauf\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  const matches = [...text.matchAll(eventLinkPattern)]

  for (const match of matches) {
    const linkContent = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    if (linkContent.length < 5 || linkContent.length > 120) continue
    if (/^(Home|Menu|Suche|Filter|Cookie|Mehr|Alle)/i.test(linkContent)) continue

    const position = match.index || 0
    const contextBefore = text.slice(Math.max(0, position - 600), position)
    const contextAfter = text.slice(position, Math.min(text.length, position + 600))
    const fullContext = contextBefore + contextAfter

    // Find region
    let region = ""
    let location = ""

    for (const r of REGIONS) {
      const regionPattern = new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s-]{1,30}),\\s*${r}(?![a-z])`, "i")
      const regionMatch = fullContext.match(regionPattern)
      if (regionMatch) {
        region = r
        location = regionMatch[1].trim()
        break
      }
      // Just region without location
      if (fullContext.includes(r)) {
        region = r
        location = r
      }
    }

    if (!region) continue

    // Find date
    let date = ""
    let dateFormatted = ""
    let month = ""
    let year = "2026"

    // Pattern: Mär7, Apr15, etc.
    const shortPattern = /(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)(\d{1,2})/i
    const shortMatch = contextBefore.match(shortPattern)
    
    if (shortMatch) {
      const monthStr = shortMatch[1].toLowerCase().slice(0, 3)
      month = MONTH_MAP[monthStr] || "01"
      const day = shortMatch[2].padStart(2, "0")
      
      if (parseInt(month) <= 2) year = "2027"
      
      date = `${year}-${month}-${day}`
      dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
    } else {
      // Try: 7. März, März 7
      const longPattern = /(\d{1,2})\.?\s*(Jan|Jän|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)/i
      const longMatch = contextBefore.match(longPattern)
      
      if (longMatch) {
        const day = longMatch[1].padStart(2, "0")
        const monthStr = longMatch[2].toLowerCase().slice(0, 3)
        month = MONTH_MAP[monthStr] || "01"
        
        if (parseInt(month) <= 2) year = "2027"
        
        date = `${year}-${month}-${day}`
        dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
      }
    }

    if (!date) continue

    // Category
    let category = "Laufrennen"
    const categories = ["Trailrun", "Trail Run", "Triathlon", "Hindernislauf", "Urban Trail",
      "Backyard Ultra", "Multisport", "Aquathlon", "Crossduathlon", "Duathlon",
      "Crosstriathlon", "Marathon", "Halbmarathon", "Ultramarathon", "Berglauf"]

    for (const cat of categories) {
      if (fullContext.toLowerCase().includes(cat.toLowerCase())) {
        category = cat
        break
      }
    }

    // Distances
    const distances: string[] = []
    const distPattern = /(\d+(?:[,\.]\d+)?)\s*km/gi
    const distMatches = contextAfter.matchAll(distPattern)
    for (const dm of distMatches) {
      const dist = dm[0].trim()
      if (!distances.includes(dist) && distances.length < 8) {
        distances.push(dist)
      }
    }

    // Image
    let imageUrl: string | undefined
    const imgMatch = fullContext.match(/<img[^>]+src=["']([^"']+(?:\.jpg|\.png|\.webp)[^"']*)["']/i)
    if (imgMatch && !imgMatch[1].includes("logo") && !imgMatch[1].includes("icon")) {
      imageUrl = imgMatch[1]
      if (imageUrl.startsWith("/")) {
        imageUrl = `https://running.life${imageUrl}`
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const url = page === 1
      ? "https://running.life/laufkalender/osterreich"
      : `https://running.life/laufkalender/osterreich?page=${page}`

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9",
      },
      cache: "no-store"
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
        races: [],
        page,
        hasMore: false,
        totalPages: 0
      })
    }

    const html = await response.text()

    // Get total pages from first page
    let totalPages = 35
    if (page === 1) {
      const countMatch = html.match(/(\d+)\s*Rennen/i)
      if (countMatch) {
        totalPages = Math.ceil(parseInt(countMatch[1]) / 20)
      }
    }

    // Check if has more pages
    const hasMore = html.includes(`page=${page + 1}`)

    // Parse races
    const races = parseEventsFromHtml(html, page)

    return NextResponse.json({
      success: true,
      races,
      page,
      hasMore: hasMore || page < 35,
      totalPages
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      races: [],
      page,
      hasMore: false,
      totalPages: 0
    })
  }
}
