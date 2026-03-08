import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Filter, Folder, Timer } from "lucide-react"

interface ScraperStatsProps {
  totalRaces: number
  filteredRaces: number
  regions: number
  categories: number
  scrapedAt: string | null
}

export function ScraperStats({
  totalRaces,
  filteredRaces,
  regions,
  categories,
  scrapedAt,
}: ScraperStatsProps) {
  if (totalRaces === 0) return null

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("de-AT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const stats = [
    {
      label: "Total Races",
      value: totalRaces,
      icon: Calendar,
      color: "text-primary",
    },
    {
      label: "Showing",
      value: filteredRaces,
      icon: Filter,
      color: "text-chart-2",
    },
    {
      label: "Regions",
      value: regions,
      icon: Folder,
      color: "text-chart-4",
    },
    {
      label: "Categories",
      value: categories,
      icon: Timer,
      color: "text-chart-5",
    },
  ]

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {scrapedAt && (
        <p className="text-xs text-muted-foreground">
          Last scraped at {formatTime(scrapedAt)}
        </p>
      )}
    </div>
  )
}
