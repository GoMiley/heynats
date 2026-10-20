package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RefuseWrites makes a read-only dashboard refuse every request that could
// change something — publish, request-reply, reply, create, edit, delete,
// purge — whatever the UI shows. Only reads (GET, HEAD, OPTIONS) pass.
func RefuseWrites() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":   "This dashboard is read-only",
			"details": "Writes (publish, create, edit, delete, purge) are turned off on this server.",
		})
	}
}
