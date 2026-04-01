# Snack Overflow Integration

Snack Overflow has been integrated into this repo as a second Slack bot for managing snack/drink preferences.

## New Environment Variables

Add these to your `.env.local` (separate from the Rate My Plate variables):

```bash
# Snack Overflow Slack Bot (separate Slack app)
SNACK_SLACK_BOT_TOKEN=xoxb-...
SNACK_SLACK_SIGNING_SECRET=...
SNACK_SLACK_CHANNEL_ID=C...
```

## New Files Created

### Library Files
- `src/lib/snack-db.ts` - Database functions for snack profiles, leaderboard, out-of-stock
- `src/lib/snack-inventory.ts` - Inventory data (beverages + snacks)
- `src/lib/snack-bot.ts` - Slack bot utilities and message builders

### API Routes
- `src/app/api/snacks/events/route.ts` - Slack events webhook handler
- `src/app/api/snacks/stats/route.ts` - Dashboard stats API
- `src/app/api/health/route.ts` - Health check endpoint

### Pages
- `src/app/snacks/page.tsx` - Snack Overflow dashboard

### Modified Files (minimal)
- `src/components/Navbar.tsx` - Added "Snacks" link (1 line change)

## Slack App Setup

Create a new Slack app at https://api.slack.com/apps with these settings:

### OAuth & Permissions
Bot Token Scopes:
- `chat:write`
- `commands`
- `users:read`

### Slash Commands
| Command | Request URL | Description |
|---------|-------------|-------------|
| `/snack-profile` | `https://your-domain/api/snacks/events` | Create or edit your snack profile |
| `/snack-empty` | `https://your-domain/api/snacks/events` | Report out-of-stock item |
| `/snack-list` | `https://your-domain/api/snacks/events` | Browse inventory categories |

### Interactivity & Shortcuts
- Request URL: `https://your-domain/api/snacks/events`

### Event Subscriptions
- Request URL: `https://your-domain/api/snacks/events`

## Database Tables

The following tables are auto-created on first request:

- `snack_profiles` - User profiles with token allocations
- `snack_leaderboard` - Points and engagement tracking
- `snack_out_of_stock` - Out of stock reports
- `snack_surveys` - Weekly survey data (future feature)

## Features

### `/snack-profile` Command
Multi-step profile creation via DM:
1. **Step 1**: Allocate 100 tokens across 10 drink categories
2. **Step 2**: Allocate 100 tokens across 10 snack categories
3. **Step 3**: Pick favorite items from inventory

Points awarded:
- New profile: 10 pts
- Profile update: 5 pts

### `/snack-empty` Command
Report out-of-stock items via modal. Posts alert to channel and awards 1 point.

### Dashboard (`/snacks`)
Live dashboard showing:
- Profile count and total points
- Category demand (token allocation visualization)
- Snack Champions leaderboard
- Most Wanted Items
- Out of Stock reports table

## Categories

### Drinks (10 categories, 100 tokens)
☕ Coffee & Lattes, 🍵 Tea, 🧉 Yerba Mate, 🧃 Juice, ⚡ Energy Drinks,
🥤 Sparkling & Soda, 💧 Water, 🥛 Milk Tea, 💪 Protein Drinks, 🌿 Wellness Shots

### Snacks (10 categories, 100 tokens)
🍪 Baked Goods, 🍫 Chocolate & Candy, 🥜 Chips, 🍿 Popcorn & Crackers,
💪 Protein Bars, 🥗 Granola & Oatmeal, 🍎 Fruit Snacks, 🥩 Jerky,
🌊 Seaweed, 🥾 Trail Mix & Nuts
