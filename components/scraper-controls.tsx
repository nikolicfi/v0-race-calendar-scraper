import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2, Play, Search } from "lucide-react"

interface ScraperControlsProps {
  onScrape: () => void
  onDownload: () => void
  isLoading: boolean
  hasData: boolean
  searchTerm: string
  onSearchChange: (value: string) => void
  regionFilter: string
  onRegionChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  regions: string[]
  categories: string[]
}

export function ScraperControls({
  onScrape,
  onDownload,
  isLoading,
  hasData,
  searchTerm,
  onSearchChange,
  regionFilter,
  onRegionChange,
  categoryFilter,
  onCategoryChange,
  regions,
  categories,
}: ScraperControlsProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onScrape}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Scraping
            </>
          )}
        </Button>
        
        <Button
          onClick={onDownload}
          disabled={!hasData}
          variant="outline"
          className="border-border hover:bg-secondary"
        >
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search races..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          <Select value={regionFilter} onValueChange={onRegionChange}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Filter by region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
