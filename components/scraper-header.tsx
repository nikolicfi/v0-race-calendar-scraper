import { Activity, MapPin } from "lucide-react"

export function ScraperHeader() {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          <Activity className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Austrian Race Scraper
        </h1>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="w-4 h-4" />
        <p className="text-sm">
          Extract running events from{" "}
          <a 
            href="https://running.life/laufkalender/osterreich" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            running.life/laufkalender/osterreich
          </a>
        </p>
      </div>
    </header>
  )
}
