# Snack Overflow Integration

Snack Overflow is integrated into this repo as a second app for managing snack/drink preferences. It uses **Google Sheets as the database** (no PostgreSQL required).

## Environment Variables

Add these to your `.env.local`:

```bash
# Snack Overflow Slack Bot (separate Slack app)
SNACK_SLACK_BOT_TOKEN=xoxb-...
SNACK_SLACK_SIGNING_SECRET=...
SNACK_SLACK_CHANNEL_ID=C...

# Google Sheets (uses same service account as Rate My Plate)
SNACK_SHEET_ID=...  # Spreadsheet ID for snack inventory/profiles

# Spoonacular API (for product images - 150 free requests/day)
SPOONACULAR_API_KEY=...
```

## Architecture

### Data Storage (Google Sheets)

All data is stored in Google Sheets tabs:

| Tab | Purpose |
|-----|---------|
| `Snack Profiles` | User profiles with category allocations and favorites |
| `Snack Suggestions` | User-submitted snack suggestions |
| `Suggestion Votes` | Tracks who voted on which suggestions |
| `Snack Leaderboard` | Points and engagement tracking |
| `Beverages` | Beverage inventory |
| `Snacks` | Snack inventory |
| `Image Cache` | Cached product images (auto-populated) |

Tabs are auto-created if they don't exist.

### Library Files

| File | Purpose |
|------|---------|
| `src/lib/snack-sheets-sync.ts` | Main data layer - profiles, suggestions, votes, leaderboard |
| `src/lib/snack-sheet.ts` | Inventory reading and survey cache |
| `src/lib/snack-inventory.ts` | Inventory constants and helpers |
| `src/lib/snack-bot.ts` | Slack bot utilities and message builders |
| `src/lib/openfoodfacts-api.ts` | Open Food Facts API for product search |

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/snacks/events` | Slack events/commands webhook handler |
| `/api/snacks/suggestions` | Get/create/vote on snack suggestions |
| `/api/snacks/web-profile` | Get/save user profiles (web UI) |
| `/api/snacks/inventory` | Get inventory items by category |
| `/api/snacks/stats` | Dashboard statistics |
| `/api/snacks/search` | Search Open Food Facts for products |
| `/api/snacks/images` | Fetch product images (Spoonacular + Open Food Facts fallback, cached to Sheets) |
| `/api/snacks/test` | Testing endpoint for surveys |

### Pages

| Page | Purpose |
|------|---------|
| `/snacks` | Dashboard with suggestions leaderboard |
| `/snacks/profile` | Profile editor (allocate points, pick favorites) |

## Features

### Web UI

**Snack Profile** (`/snacks/profile`):
- Allocate 100 points across beverage and snack categories
- Pick favorite items from inventory
- Redirects to dashboard after saving

**Suggestions Leaderboard** (`/snacks`):
- Submit new snack suggestions with autocomplete (Open Food Facts)
- Upvote/downvote suggestions (one vote per user per item)
- Auto-upvote when you submit a suggestion
- Ranked leaderboard with medals

### Slack Commands

| Command | Description |
|---------|-------------|
| `/snack-profile` | Create or edit snack profile via DM |
| `/snack-empty` | Report out-of-stock item |
| `/snack-list` | Browse inventory categories |

### Points System

| Action | Points |
|--------|--------|
| New profile | 10 pts |
| Profile update | 5 pts |
| Report out-of-stock | 1 pt |

## Slack App Setup

Create a new Slack app at https://api.slack.com/apps:

### OAuth & Permissions
Bot Token Scopes: `chat:write`, `commands`, `users:read`

### Slash Commands
Request URL: `https://your-domain/api/snacks/events`

### Interactivity & Shortcuts
Request URL: `https://your-domain/api/snacks/events`

## Categories

### Beverages (10 categories)
Coffee & Lattes, Tea, Yerba Mate, Juice, Energy Drinks, Sparkling & Soda, Water, Milk Tea, Protein Drinks, Wellness Shots

### Snacks (10 categories)
Baked Goods, Chocolate & Candy, Chips, Popcorn & Crackers, Protein Bars, Granola & Oatmeal, Fruit Snacks, Jerky, Seaweed, Trail Mix & Nuts
