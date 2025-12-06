# Who Is Seeing

A real-time widget that displays "X viewing this" on any webpage using PocketBase.

## Deployment

### 1. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Deploy to Fly.io

```bash
# Create the app (don't deploy yet)
fly launch --no-deploy

# Create persistent volume for PocketBase data
fly volumes create pb_data --size=1 --region=gru

# Deploy
fly deploy
```

### 3. Configure PocketBase

1. Visit `https://who-is-seeing.fly.dev/_/`
2. Create an admin account
3. Create a new collection named `viewers` with:

**Fields:**
| Field | Type | Required |
|-------|------|----------|
| url | text | yes |
| session_id | text | yes |

**API Rules:**
| Rule | Value |
|------|-------|
| List | (empty - public) |
| View | (empty - public) |
| Create | (empty - public) |
| Update | `session_id = @request.body.session_id` |
| Delete | (leave empty for admin only) |

**Indexes:**
- Create index on `url`
- Create unique index on `url, session_id`

## Usage

Add this to your website (before `</body>`):

```html
<script>
  window.WhoIsSeeing = { pbUrl: 'https://who-is-seeing.fly.dev' };
</script>
<script src="https://who-is-seeing.fly.dev/widget.js"></script>
```

Or using data attribute:

```html
<script src="https://who-is-seeing.fly.dev/widget.js"
        data-pb-url="https://who-is-seeing.fly.dev"></script>
```

## How It Works

1. Widget generates a session ID (stored in sessionStorage)
2. Registers the viewer with PocketBase
3. Subscribes to real-time updates via SSE
4. Sends heartbeats every 30 seconds
5. Server cron job cleans up stale sessions (>2 min inactive)

## Configuration Options

```javascript
window.WhoIsSeeing = {
  pbUrl: 'https://who-is-seeing.fly.dev',  // Required
  heartbeat: 30000                          // Optional (ms)
};
```

## Programmatic Access

```javascript
// Get current count
window.WhoIsSeeing.getCount();

// Listen to count changes
window.WhoIsSeeing.tracker.onCountChange((count) => {
  console.log('Viewers:', count);
});
```
