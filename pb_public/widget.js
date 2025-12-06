(function () {
  "use strict";

  // Capture script reference immediately (becomes null after initial execution)
  const currentScript = document.currentScript;

  // Configuration
  const config = window.WhoIsSeeing || {};
  const PB_URL = config.pbUrl || currentScript?.dataset?.pbUrl || "";
  const HEARTBEAT_INTERVAL = config.heartbeat || 30000;
  const SESSION_KEY = "whos-viewing-session-id";

  // Generate or retrieve session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId =
        "sess_" +
        Math.random().toString(36).substr(2, 9) +
        "_" +
        Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  // Normalize URL (remove hash, trailing slash)
  function normalizeUrl(url) {
    const u = new URL(url || window.location.href);
    return u.origin + u.pathname.replace(/\/$/, "") + u.search;
  }

  // Viewer Tracker - handles PocketBase communication
  class ViewerTracker {
    constructor(pbUrl) {
      this.pbUrl = pbUrl.replace(/\/$/, "");
      this.sessionId = getSessionId();
      this.pageUrl = normalizeUrl();
      this.recordId = null;
      this.eventSource = null;
      this.clientId = null;
      this.viewerCount = 0;
      this.callbacks = [];
      this.heartbeatTimer = null;
    }

    async register() {
      try {
        const existing = await this.findExistingSession();

        if (existing) {
          this.recordId = existing.id;
          await this.updateHeartbeat();
        } else {
          const response = await fetch(
            `${this.pbUrl}/api/collections/viewers/records`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: this.pageUrl,
                session_id: this.sessionId,
              }),
            }
          );

          if (!response.ok) throw new Error("Failed to register viewer");
          const data = await response.json();
          this.recordId = data.id;
        }

        this.startHeartbeat();
        await this.connectRealtime();
        await this.fetchViewerCount();
      } catch (error) {
        console.error("[WhoIsSeeing] Registration failed:", error);
      }
    }

    async findExistingSession() {
      const filter = encodeURIComponent(
        `url = "${this.pageUrl}" && session_id = "${this.sessionId}"`
      );
      const response = await fetch(
        `${this.pbUrl}/api/collections/viewers/records?filter=${filter}&perPage=1`
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.items?.[0] || null;
    }

    async updateHeartbeat() {
      if (!this.recordId) return;

      try {
        await fetch(
          `${this.pbUrl}/api/collections/viewers/records/${this.recordId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: this.sessionId }),
          }
        );
      } catch (error) {
        console.error("[WhoIsSeeing] Heartbeat failed:", error);
      }
    }

    startHeartbeat() {
      this.heartbeatTimer = setInterval(() => {
        this.updateHeartbeat();
      }, HEARTBEAT_INTERVAL);
    }

    async connectRealtime() {
      return new Promise((resolve) => {
        this.eventSource = new EventSource(`${this.pbUrl}/api/realtime`);

        this.eventSource.addEventListener("PB_CONNECT", async (e) => {
          const data = JSON.parse(e.data);
          this.clientId = data.clientId;
          await this.subscribe();
          resolve();
        });

        this.eventSource.addEventListener("viewers", (e) => {
          const data = JSON.parse(e.data);
          if (data.record.url === this.pageUrl) {
            this.fetchViewerCount();
          }
        });

        this.eventSource.onerror = () => {
          setTimeout(() => this.connectRealtime(), 5000);
        };
      });
    }

    async subscribe() {
      await fetch(`${this.pbUrl}/api/realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: this.clientId,
          subscriptions: ["viewers"],
        }),
      });
    }

    async fetchViewerCount() {
      try {
        const filter = encodeURIComponent(`url = "${this.pageUrl}"`);
        const response = await fetch(
          `${this.pbUrl}/api/collections/viewers/records?filter=${filter}&perPage=1`
        );

        if (!response.ok) throw new Error("Failed to fetch count");
        const data = await response.json();

        this.viewerCount = data.totalItems;
        this.notifyCallbacks();
      } catch (error) {
        console.error("[WhoIsSeeing] Failed to fetch count:", error);
      }
    }

    onCountChange(callback) {
      this.callbacks.push(callback);
      callback(this.viewerCount);
    }

    notifyCallbacks() {
      this.callbacks.forEach((cb) => cb(this.viewerCount));
    }

    unregister() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      if (this.eventSource) {
        this.eventSource.close();
      }
    }
  }

  // Widget UI Component
  class ViewerWidget {
    constructor(tracker) {
      this.tracker = tracker;
      this.element = null;
      this.createWidget();

      tracker.onCountChange((count) => {
        this.updateDisplay(count);
      });
    }

    createWidget() {
      this.element = document.createElement("div");
      this.element.id = "whos-viewing-widget";
      this.injectStyles();
      document.body.appendChild(this.element);
    }

    injectStyles() {
      const styles = document.createElement("style");
      styles.textContent = `
                #whos-viewing-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    transition: opacity 0.3s ease;
                }
                #whos-viewing-widget.hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                #whos-viewing-widget .dot {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background: #4ade80;
                    border-radius: 50%;
                    margin-right: 8px;
                    animation: whos-viewing-pulse 2s infinite;
                }
                @keyframes whos-viewing-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `;
      document.head.appendChild(styles);
    }

    updateDisplay(count) {
      const text = count === 1 ? "1 viewing this" : `${count} viewing this`;
      this.element.innerHTML = `<span class="dot"></span>${text}`;
      this.element.classList.toggle("hidden", count === 0);
    }
  }

  // Initialize
  async function init() {
    if (!PB_URL) {
      console.error(
        '[WhoIsSeeing] PocketBase URL not configured. Set window.WhoIsSeeing = { pbUrl: "https://your-pocketbase.fly.dev" } or use data-pb-url attribute.'
      );
      return;
    }

    const tracker = new ViewerTracker(PB_URL);
    const widget = new ViewerWidget(tracker);

    await tracker.register();

    window.addEventListener("beforeunload", () => {
      tracker.unregister();
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        tracker.updateHeartbeat();
      }
    });

    window.WhoIsSeeing = {
      ...config,
      tracker,
      widget,
      getCount: () => tracker.viewerCount,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
