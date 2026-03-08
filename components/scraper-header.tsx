import { Activity, Database, FileText, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function ScraperHeader() {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">
            Austrian Race Scraper
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
              650+ Events
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground text-xs">
              All Categories
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground text-xs">
              All Regions
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span>
            Source:{" "}
            <a 
              href="https://running.life/laufkalender/osterreich" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              running.life/laufkalender/osterreich
            </a>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span>Scrapes all pages automatically</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>Export to CSV</span>
        </div>
      </div>
    </header>
  )
}
