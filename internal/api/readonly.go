package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RefuseWrites makes a read-only dashboard refuse every request that could
// change something — publish, request-reply, reply, create, edit, delete,
// purge — whatever the UI shows. Only reads (GET, HEAD, OPTIONS) pass, and
// never with a queue group: a viewer joining one would take core-NATS
// deliveries away from the real subscriber in that group.
func RefuseWrites() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			if c.Query("queue_group") == "" {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":   "This dashboard is read-only",
			"details": "Writes (publish, create, edit, delete, purge) are turned off on this server.",
		})
	}
}

// RefuseLiveTap turns live watching off: every subscribe stream (a subject, or a
// stream's subject) answers 404 at once instead of hanging behind a proxy that
// buffers streaming responses until its own timeout.
func RefuseLiveTap() gin.HandlerFunc {
	return func(c *gin.Context) {
		// The matched route, not the URL: a KV key may contain "/subscribe/".
		route := c.FullPath()
		if strings.HasSuffix(route, "/subscribe") || strings.Contains(route, "/subscribe/") {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
				"error":   "Live watching is turned off",
				"details": "This server cannot stream messages live; browse the stored messages instead.",
			})
			return
		}
		c.Next()
	}
}
