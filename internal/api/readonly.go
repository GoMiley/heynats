package api

import (
	"net/http"

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
