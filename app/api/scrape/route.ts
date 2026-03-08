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

  // The HTML structure is:
  // <section wire:key="event:XXXXX">
  //   <div class="event-card-row">
  //     <div class="event-calendar"> (contains month + day)
  //     <a href="/de/termine/race-slug">Race Name</a>
  //     Location, Region
  //     <a class="label-distance">X km</a>
  
  // Split HTML by event sections
  const eventSections = html.split(/wire:key="event:\d+"/)
  
  for (let i = 1; i < eventSections.length; i++) {
    const section = eventSections[i]
    
    // Get the section up to the next major boundary
    const sectionEnd = section.indexOf('wire:key="event:')
    const eventHtml = sectionEnd > 0 ? section.slice(0, sectionEnd) : section.slice(0, 3000)
    
    // Extract date from event-calendar div
    // Format: <div class="event-calendar">...<div>Mär</div>...<div>8</div>...
    let date = ""
    let dateFormatted = ""
    let month = ""
    let year = "2026"
    
    const calendarMatch = eventHtml.match(/event-calendar[\s\S]*?<div[^>]*>([A-Za-zäü]{3})<\/div>[\s\S]*?<div[^>]*>(\d{1,2})(?:-(\d{1,2}))?<\/div>/i)
    if (calendarMatch) {
      const monthStr = calendarMatch[1].toLowerCase().slice(0, 3)
      month = MONTH_MAP[monthStr] || "03"
      const day = calendarMatch[2].padStart(2, "0")
      year = parseInt(month) <= 2 ? "2027" : "2026"
      date = `${year}-${month}-${day}`
      dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
    }
    
    if (!date) continue
    
    // Extract race URL and name from the main event link
    // The race link is usually the one with /de/termine/ that has text content (not just an image)
    const linkMatches = [...eventHtml.matchAll(/<a[^>]*href="([^"]*\/de\/termine\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    
    let eventUrl = ""
    let raceName = ""
    
    for (const linkMatch of linkMatches) {
      const url = linkMatch[1]
      const content = linkMatch[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      
      // Skip distance links (they have label-distance class)
      if (linkMatch[0].includes("label-distance")) continue
      
      // Skip image-only links (content is empty or very short)
      if (content.length > 3 && content.length < 150) {
        eventUrl = url.startsWith("http") ? url : `https://running.life${url}`
        raceName = content
        break
      }
    }
    
    // If no name found from links, try to get it from h2 or strong tags
    if (!raceName) {
      const nameMatch = eventHtml.match(/<(?:h2|h3|strong)[^>]*>([\s\S]*?)<\/(?:h2|h3|strong)>/i)
      if (nameMatch) {
        raceName = nameMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      }
    }
    
    if (!raceName || raceName.length < 3) continue
    
    // Skip navigation items
    if (/^(Home|Menu|Suche|Filter|Mehr|Alle|Monatliche|Entdecken|\d+ km)$/i.test(raceName)) continue
    
    // Extract location and region
    // Format is usually: City, Region (e.g., "Wien, Wien" or "Graz, Steiermark")
    let location = ""
    let region = ""
    
    // Look for "City, Region" pattern after the race name
    for (const r of REGIONS) {
      const locPattern = new RegExp(`([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\\s\\.-]{1,40}),\\s*${r}(?![a-z])`, "i")
      const locMatch = eventHtml.match(locPattern)
      if (locMatch) {
        location = locMatch[1].trim()
        region = r
        break
      }
    }
    
    // If no match with city, just look for region name
    if (!region) {
      for (const r of REGIONS) {
        if (eventHtml.includes(r)) {
          region = r
          location = r
          break
        }
      }
    }
    
    if (!region) {
      region = "Österreich"
      location = "Österreich"
    }
    
    // Extract distances from label-distance links
    const distances: string[] = []
    const distMatches = [...eventHtml.matchAll(/label-distance[^>]*>(\d+(?:[,\.]\d+)?)\s*km/gi)]
    for (const dm of distMatches) {
      const dist = `${dm[1]} km`
      if (!distances.includes(dist) && distances.length < 10) {
        distances.push(dist)
      }
    }
    
    // Also check for distances in plain text
    if (distances.length === 0) {
      const plainDistMatches = [...eventHtml.matchAll(/>(\d+(?:[,\.]\d+)?)\s*km</gi)]
      for (const dm of plainDistMatches) {
        const dist = `${dm[1]} km`
        if (!distances.includes(dist) && distances.length < 10) {
          distances.push(dist)
        }
      }
    }
    
    // Determine category from race name or context
    let category = "Laufrennen"
    const contextLower = (raceName + " " + eventHtml).toLowerCase()
    
    const categoryMap = [
      { keywords: ["trailrun", "trail run", "trail"], cat: "Trailrun" },
      { keywords: ["triathlon"], cat: "Triathlon" },
      { keywords: ["hindernislauf", "obstacle"], cat: "Hindernislauf" },
      { keywords: ["halbmarathon", "half marathon", "half-marathon"], cat: "Halbmarathon" },
      { keywords: ["ultramarathon", "ultra marathon", "ultra-marathon", "backyard"], cat: "Ultramarathon" },
      { keywords: ["marathon"], cat: "Marathon" },
      { keywords: ["duathlon"], cat: "Duathlon" },
      { keywords: ["berglauf", "vertical", "bergrennen"], cat: "Berglauf" },
    ]
    
    for (const { keywords, cat } of categoryMap) {
      if (keywords.some(k => contextLower.includes(k))) {
        category = cat
        break
      }
    }
    
    // Check for duplicate (same name and date)
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
      eventUrl,
      imageUrl: undefined
    })
  }

  return races
}
